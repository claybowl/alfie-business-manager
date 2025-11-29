"""
Graphiti Temporal Knowledge Graph Server
FastAPI server to serve Graphiti temporal knowledge graph data
"""

import os
import asyncio
from typing import Dict, Any, List
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn
from dotenv import load_dotenv

from graphiti_client import get_graphiti_client, GraphitiClient

load_dotenv()

# Initialize FastAPI app
app = FastAPI(
    title="Graphiti Knowledge Graph API",
    description="Temporal knowledge graph API for Alfie Business Manager",
    version="1.0.0"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:8000"],  # Frontend and Node.js backend
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global client instance
graphiti_client: GraphitiClient = None

# Pydantic models
class EpisodeRequest(BaseModel):
    content: str
    source_name: str = "alfie_conversation"
    episode_type: str = "message"
    metadata: Dict[str, Any] = None

class SearchRequest(BaseModel):
    query: str
    limit: int = 10
    center_node_uuid: str = None

class ClearRequest(BaseModel):
    confirm: bool = False

# Startup event
@app.on_event("startup")
async def startup_event():
    """Initialize Graphiti client on startup."""
    global graphiti_client
    try:
        graphiti_client = await get_graphiti_client()
        print("[OK] Graphiti client initialized successfully")
    except Exception as e:
        print(f"[ERROR] Failed to initialize Graphiti client: {e}")
        # Don't exit the server, but log the error

@app.get("/")
async def root():
    """Health check endpoint."""
    return {"status": "ok", "service": "graphiti-api"}

@app.get("/health")
async def health_check():
    """Detailed health check endpoint."""
    status = {
        "status": "ok",
        "graphiti_connected": graphiti_client is not None,
        "neo4j_uri": os.getenv("NEO4J_URI", "not configured"),
        "message": "Graphiti service is running"
    }

    if graphiti_client:
        try:
            # Test connection
            await graphiti_client.initialize()
            status["graphiti_initialized"] = True
        except Exception as e:
            status["status"] = "error"
            status["error"] = str(e)

    return status

@app.post("/episodes")
async def add_episode(episode: EpisodeRequest):
    """Add a new episode to the knowledge graph."""
    if not graphiti_client:
        raise HTTPException(status_code=503, detail="Graphiti client not initialized")

    try:
        result = await graphiti_client.add_episode(
            content=episode.content,
            source_name=episode.source_name,
            episode_type=episode.episode_type,
            metadata=episode.metadata
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/conversations")
async def add_conversation(request: Dict[str, Any]):
    """Add a full conversation to the knowledge graph."""
    if not graphiti_client:
        raise HTTPException(status_code=503, detail="Graphiti client not initialized")

    try:
        # This endpoint expects a conversation format
        # For now, we'll treat it as a single episode
        content = request.get("content", "")
        source_name = request.get("source_name", "conversation")

        result = await graphiti_client.add_episode(
            content=content,
            source_name=source_name,
            episode_type="json"
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/search")
async def search_graph(request: SearchRequest):
    """Search the knowledge graph."""
    if not graphiti_client:
        raise HTTPException(status_code=503, detail="Graphiti client not initialized")

    try:
        result = await graphiti_client.search(
            query=request.query,
            limit=request.limit,
            center_node_uuid=request.center_node_uuid
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/graph")
async def get_graph():
    """Get complete graph data for visualization."""
    if not graphiti_client:
        raise HTTPException(status_code=503, detail="Graphiti client not initialized")

    try:
        result = await graphiti_client.get_graph_data()
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/nodes")
async def get_nodes(limit: int = 100):
    """Get all nodes from the graph."""
    if not graphiti_client:
        raise HTTPException(status_code=503, detail="Graphiti client not initialized")

    try:
        result = await graphiti_client.get_nodes(limit=limit)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/edges")
async def get_edges(limit: int = 200):
    """Get all edges from the graph."""
    if not graphiti_client:
        raise HTTPException(status_code=503, detail="Graphiti client not initialized")

    try:
        result = await graphiti_client.get_edges(limit=limit)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/graph")
async def clear_graph(request: ClearRequest):
    """Clear the entire knowledge graph."""
    if not graphiti_client:
        raise HTTPException(status_code=503, detail="Graphiti client not initialized")

    if not request.confirm:
        raise HTTPException(status_code=400, detail="Please confirm by setting confirm=true")

    try:
        result = await graphiti_client.clear_graph()
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    # Run the server on port 8500 (different from Node.js backend on 8000)
    uvicorn.run(
        "server:app",
        host="0.0.0.0",
        port=8500,
        reload=True,
        log_level="info"
    )