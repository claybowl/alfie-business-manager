# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Alfie Business Manager is an AI-powered business management system with 3D knowledge graph visualization. It integrates with external services (Linear, Notion, Gemini AI) and uses a Graphiti temporal knowledge graph service to maintain dynamic entity relationships extracted from conversations.

## Core Architecture

### Frontend (React + Vite)
- **Location:** Root directory
- **Tech Stack:** React 19, TypeScript, Vite, Three.js
- **Key Features:**
  - 5-tab interface: Agent, Chat, Briefing, Knowledge Graph (ContextView), Settings
  - 3D force-directed graph visualization with `react-force-graph-3d`
  - Cyberpunk/neon visual theme with custom CSS
  - Local node position persistence via localStorage

### Backend (Express.js)
- **Location:** `/backend`
- **Tech Stack:** Express.js, TypeScript (compiled to Node.js), MCP SDK, CORS
- **Responsibilities:**
  - Express server on port 3002 (default)
  - Proxies to Pieces MCP service (SSE-based at `http://localhost:39300`)
  - Proxies to Graphiti Python microservice
  - API endpoints for graph operations, health checks, data management

### Graphiti Service (Python/FastAPI)
- **Location:** `/graphiti-service`
- **Tech Stack:** FastAPI, Python, Graphiti library for temporal knowledge graphs
- **Responsibilities:**
  - Runs on port 8000 (configurable via `GRAPHITI_SERVICE_URL`)
  - Extracts entities and relationships from conversations
  - Maintains temporal context of entities over time
  - Provides search and data retrieval endpoints

## Data Flow

1. **User Input** → Frontend (React components)
2. **API Calls** → Backend Express proxy (`:3002`)
3. **Graph Operations** → Graphiti service (`:8000`)
4. **Knowledge Graph Display** → ContextView (3D visualization)
5. **Conversation State** → Frontend utilities cache + localStorage

## Key Development Commands

### Frontend
```bash
npm install                    # Install dependencies
npm run dev                    # Start Vite dev server (port 3000)
npm run build                  # Build for production
npm run preview               # Preview production build
```

### Backend
```bash
cd backend
npm install                    # Install dependencies
npm run dev                    # Auto-reload development (node --watch)
npm start                      # Production server
```

### Graphiti Service
```bash
cd graphiti-service
pip install -r requirements.txt
python main.py                # Start FastAPI service (port 8000)
# or with Docker:
docker build -t alfie-graphiti .
docker run -p 8000:8000 alfie-graphiti
```

### Full Stack Development (3 terminals)
```bash
# Terminal 1: Backend
cd backend && npm run dev

# Terminal 2: Frontend
npm run dev

# Terminal 3: Graphiti service
cd graphiti-service && python main.py
```

## Environment Configuration

### Frontend (`.env.local`)
```env
GEMINI_API_KEY=your_key
LINEAR_API_KEY=your_key
NOTION_API_KEY=your_key
OPENAI_API_KEY=your_key (optional)
NEO4J_URI=your_uri
NEO4J_USERNAME=your_username
NEO4J_PASSWORD=your_password
```

### Backend (`backend/.env`)
```env
GEMINI_API_KEY=your_key
LINEAR_API_KEY=your_key
NOTION_API_KEY=your_key
PORT=3002 (default)
GRAPHITI_SERVICE_URL=http://localhost:8000 (default)
```

### Graphiti Service (`graphiti-service/.env`)
- Configure Graphiti API credentials and database connections
- See `graphiti-service/requirements.txt` for dependencies

## Frontend Architecture

### Component Structure
- **App.tsx**: Main router with tab navigation
- **components/AgentView.tsx**: AI agent interaction interface
- **components/ChatView.tsx**: Chat/conversation interface
- **components/ContextView.tsx**: 3D knowledge graph visualization (core 3D visualization logic)
- **components/BriefingView.tsx**: Data briefing/summary view
- **components/SettingsView.tsx**: Configuration and API key management
- **components/Tabs.tsx**: Navigation tab system
- **components/Icons.tsx**: SVG icon components

### Utilities
- **utils/knowledgeGraph.ts**: Graph data fetching, caching, and API integration with Graphiti
- **utils/conversations.ts**: Conversation state management
- **utils/briefing.ts**: Briefing generation logic
- **utils/audio.ts**: Audio capture/playback utilities
- **utils/apiKey.ts**: API key validation and storage

### Key Patterns
- **Caching**: Graph data cached for 5 seconds in `knowledgeGraph.ts` to prevent excessive API calls
- **Position Persistence**: Node positions saved to localStorage for visual layout persistence (not data)
- **Event Dispatching**: `graphDataUpdated` events trigger component re-renders when graph changes
- **Three.js Integration**: Direct Three.js material manipulation for custom 3D node rendering

## Backend Architecture

### Express Server Structure (`backend/server.js`)
- CORS enabled for frontend communication
- SSE client transport to Pieces MCP service
- Proxies requests to Graphiti service
- Health check endpoints

### Critical Configuration
- **PIECES_SSE_URL**: `http://localhost:39300/model_context_protocol/2024-11-05/sse` (hardcoded, requires Pieces to be running)
- **GRAPHITI_SERVICE_URL**: Configurable, defaults to `http://localhost:8000`
- **PORT**: Defaults to 3002

### API Endpoints (defined in backend)
- `/api/graph/data`: GET graph state from Graphiti
- `/api/graph/episode`: POST add episode/conversation to graph
- `/api/graph/conversation`: POST add full conversation to graph
- `/api/graph/search`: GET search the knowledge graph
- `/api/graph/clear`: DELETE clear all graph data
- `/api/graph/health`: GET health status of Graphiti service

## Graphiti Service Architecture

### Key Endpoints (`graphiti-service/main.py`)
- `POST /episode`: Add episode and extract entities/relationships
- `GET /search`: Search the knowledge graph
- `POST /conversation`: Add full conversation for entity extraction
- `GET /health`: Service health check
- `DELETE /clear`: Clear all data

### Integration Points
- Extracts entities and temporal relationships from unstructured text
- Maintains "valid_at" timestamps for entity validity windows
- Provides full-text search capabilities
- Returns structured node/link data for visualization

## Common Development Tasks

### Adding a New API Endpoint
1. Define endpoint in `backend/server.js` or `graphiti-service/main.py`
2. Add frontend API call in appropriate utility file
3. Test with curl or Postman first, then from frontend

### Updating the Knowledge Graph Visualization
1. Modify node/link styling in `components/ContextView.tsx` (THEME object, render functions)
2. Adjust physics simulation parameters (forceCollide, forceManyBody)
3. Test node layout with SPREAD button

### Extracting Entity Data from Conversations
1. New conversations go through `addConversationToGraph()` in `knowledgeGraph.ts`
2. Graphiti service automatically extracts entities and relationships
3. Graph cache is invalidated, triggering UI refresh

### Debugging Graph Data Issues
1. Check `http://localhost:3002/api/graph/health` for Graphiti connectivity
2. Inspect network tab for `/api/graph/data` responses
3. Use localStorage inspection for saved node positions (`alfie-graph-positions`)
4. Enable backend debug: `cd backend && DEBUG=* npm run dev`

## Important Implementation Details

### 3D Graph Rendering (ContextView)
- Uses `react-force-graph-3d` with custom Three.js materials
- Node rendering: Custom sphere geometry with glow effects
- Physics: D3-force with collision detection and many-body forces
- Camera: Orbiting controls with zoom, pan, rotate

### Knowledge Graph Data Flow
1. Frontend calls `fetchGraphData()` → Backend `/api/graph/data` → Graphiti service
2. Graphiti returns nodes and links in standardized format
3. Frontend applies saved positions from localStorage
4. D3-force simulation takes over for physics-based layout
5. User can manually arrange nodes, positions persist

### Caching Strategy
- Graph data cached for 5 seconds to avoid overwhelming Graphiti service
- Cache invalidated when episodes/conversations added
- Node positions cached separately in localStorage (UI-only)
- Cache bypass possible but not recommended for high-frequency operations

### Port Binding
- Frontend: 3000 (Vite auto-increment if busy)
- Backend: 3002 (configurable)
- Graphiti: 8000 (configurable via `GRAPHITI_SERVICE_URL`)
- Pieces MCP: 39300 (hardcoded, requires local Pieces installation)

## Testing & Debugging

### Check All Services Running
```bash
# Frontend
curl http://localhost:3000

# Backend
curl http://localhost:3002/api/graph/health

# Graphiti
curl http://localhost:8000/health

# Pieces (if needed)
curl http://localhost:39300
```

### Clear Application State
- Clear graph: Use SettingsView "Clear Graph" button
- Clear localStorage: `localStorage.clear()` in browser console
- Restart services: Kill and restart all three servers

## Deployment Notes

- Frontend: Deploy static build to Vercel or similar
- Backend: Deploy to Railway, Heroku, or traditional servers
- Graphiti: Containerize with provided Dockerfile, deploy to any container platform
- Ensure environment variables set on deployment platform
- CORS configured to allow frontend origin
