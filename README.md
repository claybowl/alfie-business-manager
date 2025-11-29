<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Alfie Business Manager

A comprehensive AI-powered business management system with 3D knowledge graph visualization, featuring an intelligent agent that can interact with various business tools and services.

**View your app in AI Studio:** https://ai.studio/apps/drive/1gW7tD_4RodbML39BzM7jM8AlzeqY_4bG

## 🚀 Quick Start

### Prerequisites
- **Node.js** (v18 or higher)
- **npm** or **pnpm** package manager

### 1. Clone & Install Dependencies
```bash
git clone <repository-url>
cd Alfie-Business-Manager
npm install
cd backend && npm install
cd ..
```

### 2. Environment Configuration
Copy and configure the environment files:

**Frontend (`.env.local`):**
```env
GEMINI_API_KEY=your_gemini_api_key_here
LINEAR_API_KEY=your_linear_api_key_here
NOTION_API_KEY=your_notion_api_key_here
OPENAI_API_KEY=your_openai_api_key_here
NEO4J_URI=your_neo4j_uri_here
NEO4J_USERNAME=your_neo4j_username_here
NEO4J_PASSWORD=your_neo4j_password_here
```

**Backend (`backend/.env`):**
```env
GEMINI_API_KEY=your_gemini_api_key_here
LINEAR_API_KEY=your_linear_api_key_here
NOTION_API_KEY=your_notion_api_key_here
PORT=8000
```

### 3. Start the Application

**Option A: Development Mode (Recommended)**
```bash
# Terminal 1: Start Backend Server
cd backend
npm run dev

# Terminal 2: Start Frontend Development Server
npm run dev
```

**Option B: Production Mode**
```bash
# Terminal 1: Start Backend Server
cd backend
npm start

# Terminal 2: Start Frontend Production Server
npm run build
npm run preview
```

The application will be available at:
- **Frontend:** http://localhost:3000
- **Backend API:** http://localhost:8000 (or PORT specified in .env)

## 🏗️ Architecture

### Frontend (React + Vite)
- **Framework:** React 19 with TypeScript
- **Build Tool:** Vite
- **2D Visualization:** React Force Graph 2D with Canvas rendering
- **Styling:** Custom CSS with cyberpunk/neon theme
- **Key Features:**
  - 2D Interactive knowledge graph with wire geometric nodes
  - Real-time data visualization
  - Node relationship mapping
  - Search and navigation controls

### Backend (Express + MCP SDK)
- **Framework:** Express.js with TypeScript
- **AI Integration:** Model Context Protocol (MCP) SDK
- **Database:** Neo4j (graph database)
- **External APIs:**
  - Google Gemini AI
  - Linear (project management)
  - Notion (documentation)
  - OpenAI (AI capabilities)
- **Key Features:**
  - Knowledge graph management
  - AI agent interactions
  - Data synchronization
  - API proxy services

## 🎮 2D Knowledge Graph Controls

**Navigation:**
- **Left Click:** Select node
- **Left Click + Drag:** Move nodes
- **Scroll:** Zoom in/out
- **Right Click + Drag:** Pan the view
- **Double-click:** Fit view to all nodes

**Interactive Features:**
- **SPREAD Button:** Auto-distribute nodes with physics simulation
- **Search:** Find and focus on specific entities
- **Node Highlighting:** Connected nodes light up when selecting
- **Sidebar Navigation:** Click connections to jump between nodes

## 🔧 Development Commands

### Frontend
```bash
npm install          # Install dependencies
npm run dev          # Start development server (port 3000)
npm run build        # Build for production
npm run preview      # Preview production build
```

### Backend
```bash
cd backend
npm install          # Install dependencies
npm run dev          # Start with auto-reload (port 8000)
npm start            # Start production server
```

## 🚀 Deployment Instructions

### Option 1: Vercel + Railway (Recommended)
**Frontend Deployment (Vercel):**
1. Push your code to GitHub
2. Connect repository to [Vercel](https://vercel.com)
3. Configure environment variables in Vercel dashboard
4. Deploy automatically on push

**Backend Deployment (Railway):**
1. Push backend code to a separate GitHub repository or use monorepo
2. Connect to [Railway](https://railway.app)
3. Set environment variables:
   - `GEMINI_API_KEY`
   - `LINEAR_API_KEY`
   - `NOTION_API_KEY`
   - `PORT` (Railway auto-assigns)
4. Deploy and get the Railway URL
5. Update frontend API endpoints to point to Railway URL

### Option 2: Docker Deployment

**Frontend Dockerfile:**
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "run", "preview"]
```

**Backend Dockerfile:**
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY backend/package*.json ./
RUN npm ci --only=production
COPY backend/ .
EXPOSE 8000
CMD ["npm", "start"]
```

**docker-compose.yml:**
```yaml
version: '3.8'
services:
  frontend:
    build: .
    ports:
      - "3000:3000"
    environment:
      - VITE_API_URL=http://backend:8000
    depends_on:
      - backend

  backend:
    build: ./backend
    ports:
      - "8000:8000"
    environment:
      - GEMINI_API_KEY=${GEMINI_API_KEY}
      - LINEAR_API_KEY=${LINEAR_API_KEY}
      - NOTION_API_KEY=${NOTION_API_KEY}
      - PORT=8000
```

### Option 3: Traditional Server Deployment

**Prerequisites:**
- Node.js 18+ installed
- PM2 for process management
- Nginx for reverse proxy (optional)

**Steps:**
1. Install PM2: `npm install -g pm2`
2. Build frontend: `npm run build`
3. Start backend:
   ```bash
   cd backend
   pm2 start server.js --name "alfie-backend"
   pm2 save
   pm2 startup
   ```
4. Start frontend:
   ```bash
   pm2 start npm --name "alfie-frontend" -- run preview
   pm2 save
   ```

## 🔒 Environment Variables

### Required Variables
| Variable | Description | Source |
|----------|-------------|---------|
| `GEMINI_API_KEY` | Google Gemini AI API key | [Google AI Studio](https://makersuite.google.com/app/apikey) |
| `LINEAR_API_KEY` | Linear API key for project management | [Linear API Keys](https://linear.app/api) |
| `NOTION_API_KEY` | Notion API key for integration | [Notion Integrations](https://www.notion.so/my-integrations) |
| `OPENAI_API_KEY` | OpenAI API key (optional fallback) | [OpenAI Platform](https://platform.openai.com) |
| `NEO4J_URI` | Neo4j database connection string | [Neo4j Aura](https://neo4j.com/cloud/aura/) |
| `NEO4J_USERNAME` | Neo4j database username | Neo4j Aura |
| `NEO4J_PASSWORD` | Neo4j database password | Neo4j Aura |

### Optional Variables
| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 3000 (frontend), 8000 (backend) | Server port |
| `NODE_ENV` | development | Environment mode |

## 🎨 Features

### 2D Knowledge Graph
- **Interactive 2D visualization** with force-directed physics
- **Wire geometric node rendering** with spiral/geometric patterns
- **Real-time relationship mapping** and connection highlighting
- **Advanced node physics** with collision detection and bouncing
- **Canvas-based rendering** for smooth performance

### AI Agent Capabilities
- **Knowledge graph management** and entity relationships
- **Cross-platform integration** (Linear, Notion, Gemini)
- **Intelligent search** and navigation
- **Automated data synchronization** and updates

### User Interface
- **Cyberpunk/neon theme** with glowing effects
- **Responsive design** with mobile optimization
- **Real-time status indicators** and connection monitoring
- **Intuitive sidebar navigation** for node connections

## 📊 Troubleshooting

### Common Issues
1. **Port Already in Use:** Vite will automatically find an available port
2. **API Key Errors:** Verify all API keys are correctly set in environment files
3. **Neo4j Connection:** Check database URI and credentials
4. **Canvas Performance:** Reduce node count if experiencing lag

### Debug Mode
Enable debug logging:
```bash
# Backend debug
cd backend && DEBUG=* npm run dev

# Frontend debug
npm run dev -- --debug
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
