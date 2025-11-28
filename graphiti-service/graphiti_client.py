"""
Graphiti Temporal Knowledge Graph Client
Wraps Graphiti library for use with Alfie Business Manager
"""

import os
import asyncio
from datetime import datetime
from typing import Optional, List, Dict, Any
from dotenv import load_dotenv

load_dotenv()

# Graphiti imports
from graphiti_core import Graphiti
from graphiti_core.nodes import EpisodeType


class GraphitiClient:
    """
    Client wrapper for Graphiti temporal knowledge graph.
    Handles connection to Neo4j and provides simplified API for Alfie.
    """
    
    def __init__(self):
        self.neo4j_uri = os.getenv("NEO4J_URI")
        self.neo4j_user = os.getenv("NEO4J_USER", "neo4j")
        self.neo4j_password = os.getenv("NEO4J_PASSWORD")
        self.graphiti: Optional[Graphiti] = None
        self._initialized = False
    
    async def initialize(self) -> bool:
        """Initialize connection to Neo4j and set up Graphiti."""
        if self._initialized:
            return True
            
        try:
            print(f"Connecting to Neo4j at {self.neo4j_uri}...")
            
            # Graphiti uses uri, user, password (not neo4j_ prefixed)
            self.graphiti = Graphiti(
                uri=self.neo4j_uri,
                user=self.neo4j_user,
                password=self.neo4j_password,
            )
            
            # Try to build indices, but ignore "already exists" errors
            # (Neo4j Aura sometimes throws these even with IF NOT EXISTS)
            try:
                await self.graphiti.build_indices_and_constraints()
                print("✓ Indices created/verified")
            except Exception as idx_err:
                if "EquivalentSchemaRuleAlreadyExists" in str(idx_err):
                    print("✓ Indices already exist (OK)")
                else:
                    print(f"⚠ Index warning (non-fatal): {idx_err}")
            
            self._initialized = True
            print("✓ Graphiti initialized successfully")
            return True
            
        except Exception as e:
            print(f"✗ Failed to initialize Graphiti: {e}")
            import traceback
            traceback.print_exc()
            return False
    
    async def close(self):
        """Close the Graphiti connection."""
        if self.graphiti:
            await self.graphiti.close()
            self._initialized = False
    
    async def add_episode(
        self,
        content: str,
        source_name: str = "alfie_conversation",
        episode_type: str = "message",
        metadata: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Add a new episode (conversation, message, event) to the temporal graph.
        
        Graphiti will automatically:
        - Extract entities and relationships
        - Resolve entities to existing nodes
        - Create temporal edges with timestamps
        - Update community structures
        """
        if not self._initialized:
            await self.initialize()
        
        try:
            # Map episode type (available: message, json, text)
            ep_type = EpisodeType.message  # Default to message
            if episode_type == "text":
                ep_type = EpisodeType.text
            elif episode_type == "json":
                ep_type = EpisodeType.json
            
            # Add the episode with correct parameter names
            episode = await self.graphiti.add_episode(
                name=f"{source_name}_{datetime.now().isoformat()}",
                episode_body=content,
                source_description=f"Alfie Business Manager - {source_name}",
                reference_time=datetime.now(),
                source=ep_type,  # 'source' is the EpisodeType, not the source name!
            )
            
            return {
                "success": True,
                "episode_id": str(episode.episode.uuid) if hasattr(episode, 'episode') else None,
                "message": "Episode added successfully",
                "entities_count": len(episode.nodes) if hasattr(episode, 'nodes') else 0,
                "edges_count": len(episode.edges) if hasattr(episode, 'edges') else 0
            }
            
        except Exception as e:
            print(f"Error adding episode: {e}")
            import traceback
            traceback.print_exc()
            return {
                "success": False,
                "error": str(e)
            }
    
    async def search(
        self,
        query: str,
        limit: int = 10,
        center_node_uuid: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Search the knowledge graph using hybrid semantic + graph search.
        
        Returns relevant nodes, edges, and episodes based on the query.
        """
        if not self._initialized:
            await self.initialize()
        
        try:
            results = await self.graphiti.search(
                query=query,
                num_results=limit,
                center_node_uuid=center_node_uuid
            )
            
            # Format results for API response
            formatted_results = []
            for result in results:
                formatted_results.append({
                    "uuid": str(result.uuid) if hasattr(result, 'uuid') else None,
                    "fact": result.fact if hasattr(result, 'fact') else None,
                    "name": result.name if hasattr(result, 'name') else None,
                    "created_at": result.created_at.isoformat() if hasattr(result, 'created_at') else None,
                    "valid_at": result.valid_at.isoformat() if hasattr(result, 'valid_at') else None,
                    "invalid_at": result.invalid_at.isoformat() if hasattr(result, 'invalid_at') and result.invalid_at else None,
                })
            
            return {
                "success": True,
                "results": formatted_results,
                "count": len(formatted_results)
            }
            
        except Exception as e:
            print(f"Error searching: {e}")
            return {
                "success": False,
                "error": str(e),
                "results": []
            }
    
    async def get_nodes(self, limit: int = 100) -> Dict[str, Any]:
        """Get all entity nodes from the graph."""
        if not self._initialized:
            await self.initialize()
        
        try:
            # Query Neo4j directly for nodes
            driver = self.graphiti.driver
            
            async with driver.session() as session:
                result = await session.run(
                    """
                    MATCH (n:Entity)
                    RETURN n.uuid as id, n.name as name, labels(n) as labels, n.summary as summary
                    LIMIT $limit
                    """,
                    limit=limit
                )
                records = await result.data()
            
            nodes = []
            for record in records:
                nodes.append({
                    "id": record["name"] or record["id"],
                    "uuid": record["id"],
                    "group": record["labels"][0] if record["labels"] else "entity",
                    "summary": record.get("summary", "")
                })
            
            return {
                "success": True,
                "nodes": nodes,
                "count": len(nodes)
            }
            
        except Exception as e:
            print(f"Error getting nodes: {e}")
            return {
                "success": False,
                "error": str(e),
                "nodes": []
            }
    
    async def get_edges(self, limit: int = 200) -> Dict[str, Any]:
        """Get all relationship edges from the graph."""
        if not self._initialized:
            await self.initialize()
        
        try:
            driver = self.graphiti.driver
            
            async with driver.session() as session:
                result = await session.run(
                    """
                    MATCH (a:Entity)-[r:RELATES_TO]->(b:Entity)
                    RETURN a.name as source, b.name as target, r.fact as value, 
                           r.created_at as created_at, r.valid_at as valid_at
                    LIMIT $limit
                    """,
                    limit=limit
                )
                records = await result.data()
            
            edges = []
            for record in records:
                edges.append({
                    "source": record["source"],
                    "target": record["target"],
                    "value": record["value"] or "relates to",
                    "created_at": record.get("created_at"),
                    "valid_at": record.get("valid_at")
                })
            
            return {
                "success": True,
                "edges": edges,
                "count": len(edges)
            }
            
        except Exception as e:
            print(f"Error getting edges: {e}")
            return {
                "success": False,
                "error": str(e),
                "edges": []
            }
    
    async def get_graph_data(self) -> Dict[str, Any]:
        """
        Get complete graph data formatted for visualization.
        Compatible with react-force-graph-2d format.
        """
        nodes_result = await self.get_nodes(limit=200)
        edges_result = await self.get_edges(limit=500)
        
        return {
            "success": nodes_result["success"] and edges_result["success"],
            "nodes": nodes_result.get("nodes", []),
            "links": edges_result.get("edges", []),
            "node_count": nodes_result.get("count", 0),
            "edge_count": edges_result.get("count", 0)
        }
    
    async def clear_graph(self) -> Dict[str, Any]:
        """Clear all data from the graph. Use with caution!"""
        if not self._initialized:
            await self.initialize()
        
        try:
            driver = self.graphiti.driver
            
            async with driver.session() as session:
                await session.run("MATCH (n) DETACH DELETE n")
            
            return {
                "success": True,
                "message": "Graph cleared successfully"
            }
            
        except Exception as e:
            print(f"Error clearing graph: {e}")
            return {
                "success": False,
                "error": str(e)
            }


# Singleton instance
_client: Optional[GraphitiClient] = None


async def get_graphiti_client() -> GraphitiClient:
    """Get or create the singleton Graphiti client."""
    global _client
    if _client is None:
        _client = GraphitiClient()
        await _client.initialize()
    return _client

