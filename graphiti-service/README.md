# Graphiti Temporal Knowledge Graph Service

A FastAPI microservice that provides temporal knowledge graph capabilities for Alfie Business Manager using [Graphiti](https://github.com/getzep/graphiti) and Neo4j.

## Features

- **Temporal Edges**: Relationships have valid_from/valid_to timestamps
- **Episodic Memory**: Store conversation "episodes" with full context
- **Entity Resolution**: Automatic deduplication of entities
- **Hybrid Search**: Combine semantic and graph-based retrieval
- **Community Detection**: Group related entities automatically

## Setup

### 1. Environment Variables

Create a `.env` file:

```env
NEO4J_URI=neo4j+s://xxxxx.databases.neo4j.io:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=your-password
OPENAI_API_KEY=sk-your-key
PORT=8000
```

### 2. Install Dependencies

```bash
pip install -r requirements.txt
```

### 3. Run Locally

```bash
python main.py
```

The service will be available at `http://localhost:8000`

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| POST | `/episodes` | Add a single episode (conversation turn, event) |
| POST | `/conversations` | Add a full conversation |
| GET | `/search?query=...` | Search the knowledge graph |
| GET | `/nodes` | Get all entity nodes |
| GET | `/edges` | Get all relationships |
| GET | `/graph` | Get full graph for visualization |
| DELETE | `/graph` | Clear all graph data |

## Deployment

### Railway

1. Connect your GitHub repo to Railway
2. Add environment variables in Railway dashboard
3. Deploy!

### Render

1. Create a new Web Service
2. Connect your repo
3. Set build command: `pip install -r requirements.txt`
4. Set start command: `python main.py`
5. Add environment variables

## Integration with Alfie

The Node.js backend proxies requests to this service:

```javascript
// backend/server.js
app.post('/api/graph/episode', async (req, res) => {
  const response = await fetch(`${GRAPHITI_URL}/episodes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req.body)
  });
  res.json(await response.json());
});
```

