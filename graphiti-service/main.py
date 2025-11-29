"""
Graphiti Temporal Knowledge Graph Service
FastAPI microservice for Alfie Business Manager
"""

import os
from contextlib import asynccontextmanager
from typing import Optional, List
from dotenv import load_dotenv

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from graphiti_client import get_graphiti_client, GraphitiClient

load_dotenv()

# Pydantic models for API
class EpisodeRequest(BaseModel):
    content: str
    source: str = "alfie_conversation"
    episode_type: str = "message"  # message, text, json
    metadata: Optional[dict] = None

class SearchRequest(BaseModel):
    query: str
    limit: int = 10
    center_node_uuid: Optional[str] = None

class ConversationRequest(BaseModel):
    messages: List[dict]  # [{"role": "user", "content": "..."}, ...]
    session_id: Optional[str] = None


# Lifespan handler for startup/shutdown
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    print("Starting Graphiti service...")
    client = await get_graphiti_client()
    print("Graphiti service ready!")
    yield
    # Shutdown
    print("Shutting down Graphiti service...")
    if client:
        await client.close()


# Create FastAPI app
app = FastAPI(
    title="Graphiti Temporal Knowledge Graph Service",
    description="Temporal knowledge graph for Alfie Business Manager",
    version="1.0.0",
    lifespan=lifespan
)

# CORS for frontend access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify your frontend domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Health check
@app.get("/health")
async def health_check():
    """Health check endpoint."""
    try:
        client = await get_graphiti_client()
        return {
            "status": "healthy",
            "service": "graphiti",
            "initialized": client._initialized
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "error": str(e)
        }


# Add episode (conversation, message, event)
@app.post("/episodes")
async def add_episode(request: EpisodeRequest):
    """
    Add a new episode to the temporal knowledge graph.
    
    Graphiti will automatically extract entities and relationships,
    resolve them to existing nodes, and create temporal edges.
    """
    try:
        client = await get_graphiti_client()
        result = await client.add_episode(
            content=request.content,
            source_name=request.source,
            episode_type=request.episode_type,
            metadata=request.metadata
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Add conversation (multiple messages at once)
@app.post("/conversations")
async def add_conversation(request: ConversationRequest):
    """
    Add a full conversation to the knowledge graph.
    Formats messages into a single episode for better context extraction.
    """
    try:
        client = await get_graphiti_client()
        
        # Format conversation as text
        conversation_text = "\n".join([
            f"{msg.get('role', 'unknown').upper()}: {msg.get('content', '')}"
            for msg in request.messages
        ])
        
        result = await client.add_episode(
            content=conversation_text,
            source_name=f"alfie_session_{request.session_id}" if request.session_id else "alfie_conversation",
            episode_type="text"  # Use text for multi-turn conversations
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Search the knowledge graph
@app.get("/search")
async def search(query: str, limit: int = 10, center_node_uuid: Optional[str] = None):
    """
    Search the knowledge graph using hybrid semantic + graph search.
    Returns relevant facts, entities, and relationships.
    """
    try:
        client = await get_graphiti_client()
        result = await client.search(
            query=query,
            limit=limit,
            center_node_uuid=center_node_uuid
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Get all nodes
@app.get("/nodes")
async def get_nodes(limit: int = 100):
    """Get all entity nodes from the graph."""
    try:
        client = await get_graphiti_client()
        result = await client.get_nodes(limit=limit)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Get all edges
@app.get("/edges")
async def get_edges(limit: int = 200):
    """Get all relationship edges from the graph."""
    try:
        client = await get_graphiti_client()
        result = await client.get_edges(limit=limit)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Get full graph data for visualization
@app.get("/graph")
async def get_graph_data():
    """
    Get complete graph data formatted for react-force-graph-2d visualization.
    Returns nodes and links arrays.
    """
    try:
        client = await get_graphiti_client()
        result = await client.get_graph_data()
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Clear the graph (dangerous!)
@app.delete("/graph")
async def clear_graph():
    """
    Clear all data from the knowledge graph.
    USE WITH CAUTION - this cannot be undone!
    """
    try:
        client = await get_graphiti_client()
        result = await client.clear_graph()
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8500))
    uvicorn.run(app, host="0.0.0.0", port=port)

