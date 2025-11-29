# Alfie Business Manager - Production Deployment Plan

## Overview

Deploy Alfie Business Manager to production using:
- **Frontend**: Vercel (Vite/React static hosting)
- **Backend**: Railway (Node.js/Express API)
- **Graphiti Service**: Railway (Python/FastAPI microservice)
- **Database**: Neo4j Aura Free Tier
- **Pieces OS**: Periodic sync from local machine to cloud backend

## Architecture Diagram

```
Local Machine              Cloud Infrastructure
┌─────────────┐
│ Pieces OS   │           ┌──────────────────┐
│ :39300      │──sync──▶  │ Railway Backend  │◀──API──┐
└─────────────┘           │ Node.js/Express  │        │
                          │ :3002            │        │
                          └────────┬─────────┘        │
                               ▲   │                  │
                               │   ▼                  │
                          ┌─────────────────┐    ┌────────────┐
                          │ Graphiti Service│    │  Vercel    │
                          │ Python/FastAPI  │    │  Frontend  │
                          │ :8500           │    │  (Static)  │
                          └────────┬────────┘    └────────────┘
                                   │
                                   ▼
                          ┌─────────────────┐
                          │  Neo4j Aura     │
                          │  Graph Database │
                          └─────────────────┘
```

---

## Phase 1: Code Changes

### 1.1 Frontend - Replace Hardcoded URLs

Update all hardcoded `http://localhost:3002` references to use environment variables.

**Files to modify:**
- `utils/knowledgeGraph.ts` (line 30)
- `utils/briefing.ts` (lines 166, 277, 485)
- `components/BriefingView.tsx` (line 277)

**Change pattern:**
```typescript
// Before
const BACKEND_URL = 'http://localhost:3002';

// After
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3002';
```

### 1.2 Backend - CORS Configuration

**File:** `backend/server.js` (around line 28)

Replace the simple `app.use(cors())` with environment-aware configuration:

```javascript
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map(o => o.trim())
  : ['http://localhost:3000'];

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
```

### 1.3 Backend - Pieces Sync Endpoint

**File:** `backend/server.js`

#### Step 1: Remove Live SSE Connection

Delete lines 31-67 (the `connectToPieces()` function and global `mcpClient` setup). This removes the requirement for a live connection to local Pieces OS.

#### Step 2: Add In-Memory Data Store

Add this at the top of your route definitions (after express app setup, before routes):

```javascript
// In-memory storage for synced Pieces data
let piecesDataStore = {
  data: [],
  lastSync: null
};
```

#### Step 3: Add Sync Endpoint

Add this new endpoint (suggest placing after other API routes):

```javascript
// Endpoint to receive periodic Pieces data from local sync script
app.post('/api/pieces/sync', async (req, res) => {
  const authToken = req.headers.authorization?.replace('Bearer ', '');

  if (!process.env.SYNC_AUTH_TOKEN) {
    return res.status(503).json({
      error: 'SYNC_AUTH_TOKEN not configured on server'
    });
  }

  if (authToken !== process.env.SYNC_AUTH_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { data, timestamp } = req.body;

  piecesDataStore.data = data || [];
  piecesDataStore.lastSync = timestamp;

  console.log(`[Pieces Sync] Received ${data?.length || 0} days of data at ${timestamp}`);

  res.json({
    success: true,
    message: 'Data synced successfully',
    daysStored: piecesDataStore.data.length
  });
});
```

#### Step 4: Modify /api/pieces/activity Endpoint

Replace the existing implementation (lines 110-160) with:

```javascript
app.get('/api/pieces/activity', async (req, res) => {
  if (!piecesDataStore.data || piecesDataStore.data.length === 0) {
    return res.json({
      total: 0,
      activities: [],
      message: 'No synced Pieces data. Run pieces-sync-script.js locally to sync.'
    });
  }

  // Return synced data in expected format
  res.json({
    total: piecesDataStore.data.length,
    summaries: piecesDataStore.data,
    activities: piecesDataStore.data.map(d => ({
      name: `Workstream: ${d.dayLabel}`,
      summary: d.data,
      date: d.date,
      dayLabel: d.dayLabel
    })),
    lastSync: piecesDataStore.lastSync,
    cached: true
  });
});
```

#### Step 5: Modify /api/pieces/workstream-summaries Endpoint

Replace the existing implementation (lines 855-917) with:

```javascript
app.get('/api/pieces/workstream-summaries', async (req, res) => {
  if (!piecesDataStore.data || piecesDataStore.data.length === 0) {
    return res.json({
      total: 0,
      summaries: [],
      message: 'No synced Pieces data'
    });
  }

  // Transform synced data into expected workstream summary format
  const summaries = piecesDataStore.data.map((dayData, index) => {
    const content = dayData.data || '';

    return {
      date: dayData.date,
      dayLabel: dayData.dayLabel,
      dayIndex: index,
      fetchedAt: piecesDataStore.lastSync,
      summary: content.replace(/\\n/g, '\n').replace(/\\"/g, '"'),
      // Add empty arrays for compatibility
      coreTasks: [],
      keyDecisions: [],
      documentsReviewed: [],
      nextSteps: []
    };
  });

  res.json({
    total: summaries.length,
    summaries,
    cached: true,
    lastFetch: piecesDataStore.lastSync
  });
});
```

### 1.4 Create Pieces Sync Script

**New file:** `backend/pieces-sync-script.js`

This local script runs on your development machine and periodically syncs Pieces data to the cloud backend.

```javascript
import 'dotenv/config';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import EventSource from 'eventsource';
import fetch from 'node-fetch';

global.EventSource = EventSource;

const PIECES_SSE_URL = 'http://localhost:39300/model_context_protocol/2024-11-05/sse';
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3002';
const SYNC_INTERVAL = parseInt(process.env.PIECES_SYNC_INTERVAL) || 1800000; // 30 min default
const SYNC_AUTH_TOKEN = process.env.SYNC_AUTH_TOKEN;

if (!SYNC_AUTH_TOKEN) {
  console.error('ERROR: SYNC_AUTH_TOKEN environment variable not set');
  process.exit(1);
}

function getDateLabels(daysBack = 7) {
  const labels = [];
  const now = new Date();

  for (let i = 0; i < daysBack; i++) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);

    const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
    const dateStr = date.toISOString().split('T')[0];
    const monthDay = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    let label;
    if (i === 0) label = 'today';
    else if (i === 1) label = 'yesterday';
    else label = `${dayName} (${monthDay})`;

    labels.push({
      dayIndex: i,
      dateStr,
      label,
      queryLabel: i === 0 ? 'today' : i === 1 ? 'yesterday' : `on ${dayName}, ${monthDay}`
    });
  }
  return labels;
}

async function syncPiecesData() {
  console.log(`[Pieces Sync] Starting sync at ${new Date().toLocaleString()}...`);

  let mcpClient = null;

  try {
    // Connect to local Pieces OS
    console.log('[Pieces Sync] Connecting to Pieces MCP...');
    const transport = new SSEClientTransport(new URL(PIECES_SSE_URL));

    mcpClient = new Client(
      { name: "alfie-sync-client", version: "1.0.0" },
      { capabilities: { prompts: {}, resources: {}, tools: {} } }
    );

    await mcpClient.connect(transport);
    console.log('[Pieces Sync] ✓ Connected to Pieces OS');

    // Fetch activity data for the last 7 days
    const dateLabels = getDateLabels(7);
    const allData = [];

    for (const dayInfo of dateLabels) {
      console.log(`[Pieces Sync] Fetching data for ${dayInfo.label}...`);

      try {
        const result = await mcpClient.callTool({
          name: "ask_pieces_ltm",
          arguments: {
            question: `Give me the complete raw activity log for ${dayInfo.queryLabel} in JSON format. Include all summaries, events, applications, files opened, code edits, conversations, and timestamps.`,
            topics: ["development", "coding", "files", "projects", "work"],
            application_sources: ["Cursor", "Cursor.exe"],
            chat_llm: "gemini-2.0-flash-exp",
            connected_client: "Alfie"
          }
        });

        if (result.content && result.content[0] && result.content[0].text) {
          allData.push({
            date: dayInfo.dateStr,
            dayLabel: dayInfo.label,
            data: result.content[0].text
          });
          console.log(`[Pieces Sync] ✓ Retrieved data for ${dayInfo.label}`);
        } else {
          console.log(`[Pieces Sync] ⚠ No data for ${dayInfo.label}`);
        }
      } catch (error) {
        console.error(`[Pieces Sync] Error fetching ${dayInfo.label}:`, error.message);
      }
    }

    if (allData.length === 0) {
      console.log('[Pieces Sync] ⚠ No data retrieved from any day');
      return;
    }

    // Push to backend API
    console.log(`[Pieces Sync] Pushing ${allData.length} days of data to ${BACKEND_URL}...`);

    const response = await fetch(`${BACKEND_URL}/api/pieces/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SYNC_AUTH_TOKEN}`
      },
      body: JSON.stringify({
        data: allData,
        timestamp: new Date().toISOString()
      })
    });

    if (response.ok) {
      const result = await response.json();
      console.log(`[Pieces Sync] ✓ Successfully synced to backend: ${result.message}`);
    } else {
      const errorText = await response.text();
      console.error(`[Pieces Sync] ✗ Failed to sync: HTTP ${response.status} - ${errorText}`);
    }

  } catch (error) {
    console.error('[Pieces Sync] ✗ Error:', error);
  } finally {
    if (mcpClient) {
      try {
        await mcpClient.close();
        console.log('[Pieces Sync] Closed Pieces connection');
      } catch (e) {
        // Ignore close errors
      }
    }
  }

  console.log('[Pieces Sync] Sync complete.\n');
}

// Run initial sync
console.log('=== Alfie Pieces Sync Script ===');
console.log(`Backend URL: ${BACKEND_URL}`);
console.log(`Sync Interval: ${SYNC_INTERVAL / 60000} minutes`);
console.log('================================\n');

syncPiecesData().then(() => {
  console.log(`[Pieces Sync] Scheduled to run every ${SYNC_INTERVAL / 60000} minutes`);

  // Schedule periodic sync
  setInterval(syncPiecesData, SYNC_INTERVAL);
}).catch(error => {
  console.error('[Pieces Sync] Fatal error during initial sync:', error);
  process.exit(1);
});
```

### 1.5 Graphiti - CORS Configuration

**File:** `graphiti-service/main.py` (lines 58-65)

Replace the hardcoded CORS configuration with environment-aware setup:

```python
import os

# Get allowed origins from environment
allowed_origins = os.getenv("CORS_ORIGIN", "*").split(",")
allowed_origins = [origin.strip() for origin in allowed_origins]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### 1.6 Backend Dependencies

**File:** `backend/package.json`

Add to dependencies section:
```json
"node-fetch": "^2.7.0"
```

Then run:
```bash
cd backend
npm install
```

---

## Phase 2: Neo4j Aura Setup

Neo4j Aura is a managed cloud database service. The free tier provides everything you need.

### Steps:

1. Go to https://neo4j.com/cloud/aura/
2. Sign up or log in with your account
3. Click "Create database" or "New Instance"
4. Configure:
   - **Database Name:** `alfie-knowledge-graph`
   - **Tier:** Select **AuraDB Free** (absolutely free)
   - **Region:** Choose **US East** (or closest to Railway's US region)
5. Click Create and wait for provisioning (usually 2-3 minutes)

### Save Your Credentials

After creation, you'll see a screen with connection details. **IMPORTANT: Screenshot or save these immediately** - the password is shown only once:

```
Connection URI: neo4j+s://xxxxx.databases.neo4j.io:7687
Username: neo4j
Password: [auto-generated - SAVE THIS]
```

### Verify Connection

1. Go to Neo4j Browser (link provided in the console)
2. Paste the connection URI
3. Enter username `neo4j` and password
4. Run this test query:
   ```cypher
   RETURN "Connected!" AS message
   ```

If it returns successfully, your database is working.

---

## Phase 3: Railway Deployment

Railway is a simple platform-as-a-service that auto-detects and deploys Node.js and Python apps from GitHub.

### 3.1 Deploy Graphiti Service First

**Why first?** The backend needs to know the Graphiti service URL, so deploy Graphiti first.

**Steps:**

1. Go to https://railway.app and sign up (GitHub login recommended)
2. Create new project: Click "Create Project" → "Deploy from GitHub repo"
3. Select your `Alfie-Business-Manager` repository
4. Railway will detect services in the repo
5. For the `graphiti-service`:
   - Service name: `graphiti-service`
   - Root directory: `graphiti-service`
   - Railway auto-detects the Dockerfile
   - Click "Deploy"

**Add Environment Variables:**

In Railway dashboard, go to `graphiti-service` → Variables and add:

| Variable | Value |
|----------|-------|
| `NEO4J_URI` | `neo4j+s://xxxxx.databases.neo4j.io:7687` (from Aura) |
| `NEO4J_USER` | `neo4j` |
| `NEO4J_PASSWORD` | (your Aura password) |
| `OPENAI_API_KEY` | `sk-...` (your OpenAI key) |
| `CORS_ORIGIN` | `https://backend.up.railway.app` (placeholder for now) |
| `PORT` | `8500` |
| `PYTHONUNBUFFERED` | `1` |

**Wait for Deployment:**
- Watch the Deployments tab
- Should see "Deployment successful"
- Takes 2-5 minutes

**Get Public URL:**
1. Click `graphiti-service` in the project
2. Go to Settings → Networking
3. Click "Generate Domain"
4. Copy the URL: `https://graphiti-service.up.railway.app`
5. **Save this URL** - you'll need it for the backend

**Test Health Check:**
```bash
curl https://graphiti-service.up.railway.app/health
# Expected response: {"status":"healthy","service":"graphiti","initialized":true}
```

### 3.2 Deploy Backend Service

**Steps:**

1. In the same Railway project, click "New" → "GitHub Repo"
2. Select the same repository
3. For the backend service:
   - Service name: `backend`
   - Root directory: `backend`
   - Build command: `npm install` (Railway detects this)
   - Start command: `npm start` (Railway detects this)
   - Click "Deploy"

**Add Environment Variables:**

In Railway dashboard, go to `backend` → Variables and add:

| Variable | Value |
|----------|-------|
| `LINEAR_API_KEY` | `lin_api_...` (your Linear API key) |
| `NOTION_API_KEY` | `secret_...` (your Notion API key) |
| `OPENAI_API_KEY` | `sk-...` (your OpenAI key) |
| `GRAPHITI_SERVICE_URL` | `https://graphiti-service.up.railway.app` |
| `CORS_ORIGIN` | `https://your-vercel-app.vercel.app` (you'll update this after Vercel) |
| `SYNC_AUTH_TOKEN` | Generate with: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `PORT` | `3002` |
| `NODE_ENV` | `production` |

**Wait for Deployment:**
- Should complete in 3-5 minutes
- Check Deployments tab

**Get Public URL:**
1. Click `backend` in the project
2. Go to Settings → Networking
3. Click "Generate Domain"
4. Copy the URL: `https://backend.up.railway.app`
5. **Save this URL**

**Test Health Check:**
```bash
curl https://backend.up.railway.app/health
# Expected response: {"status":"ok","mcp_connected":false}
```

### 3.3 Update Graphiti CORS

Now that you have the actual backend URL, update Graphiti's environment variables:

1. Go to `graphiti-service` in Railway
2. Click Variables
3. Update `CORS_ORIGIN` to `https://backend.up.railway.app`
4. Click "Redeploy" (it will automatically redeploy on variable change)

---

## Phase 4: Vercel Deployment

Vercel provides free static hosting for the React frontend. It integrates directly with GitHub for automatic deployments.

### Steps:

1. Go to https://vercel.com and sign up (GitHub login recommended)
2. Click "Import Project"
3. Select your `Alfie-Business-Manager` repository
4. Configure:
   - **Framework Preset:** Vite
   - **Root Directory:** Leave blank (uses repo root)
   - **Build Command:** `npm run build`
   - **Install Command:** `npm install`
   - **Output Directory:** `dist`

**Add Environment Variables:**

Before deploying, click "Environment Variables" and add:

| Variable | Value |
|----------|-------|
| `VITE_BACKEND_URL` | `https://backend.up.railway.app` |
| `GEMINI_API_KEY` | Your Gemini API key |
| `NODE_ENV` | `production` |

**Deploy:**
- Click "Deploy"
- Vercel builds and deploys automatically
- Takes 1-3 minutes
- You'll get a URL like `https://alfie-business-manager.vercel.app`

**Save Your Vercel URL:** You'll need this to update CORS on the backend.

### Update Backend CORS

Now that Vercel has deployed your frontend, update the backend's CORS setting:

1. Go to Railway dashboard → `backend` service
2. Click Variables
3. Update `CORS_ORIGIN` to your Vercel URL (e.g., `https://alfie-business-manager.vercel.app`)
4. If you have a custom domain, use: `https://your-vercel-app.vercel.app,https://custom-domain.com`
5. Click "Redeploy"

### Verify Frontend

1. Visit your Vercel URL
2. Open browser DevTools → Console
3. Check for any CORS errors (should be none)
4. Try clicking through tabs (Agent, Context, Briefing)
5. Check Network tab to verify API calls are going to `https://backend.up.railway.app`

---

## Phase 5: Pieces OS Sync Setup

The sync script runs locally on your development machine and periodically pushes Pieces data to the cloud.

### Local Configuration

Create a new file: `backend/.env.local`

```env
BACKEND_URL=https://backend.up.railway.app
SYNC_AUTH_TOKEN=your-sync-token-from-railway
PIECES_SYNC_INTERVAL=1800000
```

**Note:** This file should NOT be committed to Git (it contains secrets). Add to `.gitignore` if not already there.

### Option A: Run with PM2 (Recommended)

PM2 is a process manager that keeps your sync script running and restarts it if it crashes.

**Install PM2 globally:**
```bash
npm install -g pm2
```

**Start the sync script:**
```bash
cd backend
pm2 start pieces-sync-script.js --name "pieces-sync"
```

**Configure auto-start on reboot:**
```bash
pm2 save
pm2 startup
```

**Check status:**
```bash
pm2 status
pm2 logs pieces-sync
```

### Option B: Run with systemd (Linux only)

Create file: `/etc/systemd/system/alfie-pieces-sync.service`

```ini
[Unit]
Description=Alfie Pieces Sync Service
After=network.target

[Service]
Type=simple
User=your-username
WorkingDirectory=/path/to/Alfie-Business-Manager/backend
ExecStart=/usr/bin/node pieces-sync-script.js
Restart=always
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

**Enable and start:**
```bash
sudo systemctl enable alfie-pieces-sync
sudo systemctl start alfie-pieces-sync
sudo systemctl status alfie-pieces-sync
```

**Check logs:**
```bash
sudo journalctl -u alfie-pieces-sync -f
```

### Verify Sync is Working

Check the logs for successful syncs:

**PM2:**
```bash
pm2 logs pieces-sync
```

**systemd:**
```bash
sudo journalctl -u alfie-pieces-sync -f
```

Expected output:
```
[Pieces Sync] Starting sync at 2025-01-15 10:30:00...
[Pieces Sync] ✓ Connected to Pieces OS
[Pieces Sync] ✓ Retrieved data for today
[Pieces Sync] ✓ Successfully synced to backend
```

**Test via API:**
```bash
curl https://backend.up.railway.app/api/pieces/workstream-summaries
```

Should return data from your synced Pieces workstreams.

---

## Phase 6: Testing & Validation

### Component-Level Tests

**Test 1: Frontend to Backend**
```bash
# In browser console (on Vercel URL)
fetch('https://backend.up.railway.app/health')
  .then(r => r.json())
  .then(console.log)
```

**Test 2: Backend to Graphiti**
```bash
curl https://backend.up.railway.app/api/graph/health
```

**Test 3: Graphiti to Neo4j**
```bash
curl https://graphiti-service.up.railway.app/nodes
```

**Test 4: Pieces Sync Data**
```bash
curl https://backend.up.railway.app/api/pieces/workstream-summaries
```

### End-to-End Tests

Test all features through the frontend:

**Agent Tab:**
- [ ] Type a message to Alfie
- [ ] Verify Gemini AI responds
- [ ] Check message saves to conversation history

**Context Tab:**
- [ ] Knowledge graph renders with nodes
- [ ] Add a conversation to the graph
- [ ] Verify nodes and edges appear
- [ ] Try toggling relationship text (off → abbrev → full)

**Briefing Tab:**
- [ ] Linear issues load from your account
- [ ] Notion pages load
- [ ] Pieces workstream data shows (from sync script)
- [ ] User notes save successfully
- [ ] All data updates correctly

**Error Checking:**
- [ ] Browser console: No CORS errors
- [ ] Browser console: No network errors
- [ ] Network tab: All API calls returning 200 status

### Performance Testing (Optional)

```bash
# Install Apache Bench
sudo apt-get install apache2-utils  # Linux
brew install httpd                  # macOS

# Test backend
ab -n 100 -c 10 https://backend.up.railway.app/health

# Expected: ~50+ requests/second
# Expected: <200ms per request (p95)
# Expected: 0 failed requests
```

---

## Phase 7: Monitoring & Maintenance

### Uptime Monitoring

**Using UptimeRobot (Free tier - 50 monitors):**

1. Go to https://uptimerobot.com
2. Sign up with email
3. Add Monitor:
   - **Monitor Type:** HTTP(s)
   - **Friendly Name:** "Alfie Frontend"
   - **URL:** `https://your-vercel-app.vercel.app`
   - **Check Interval:** 5 minutes
   - **Alert Contacts:** Add your email
   - Click "Create Monitor"

4. Repeat for backend and Graphiti:
   - `https://backend.up.railway.app/health`
   - `https://graphiti-service.up.railway.app/health`

5. Configure Alerts:
   - Click each monitor → Settings
   - Enable "Email" notifications
   - Select "Alert every 5 minutes"

### Railway Metrics

Built-in monitoring available in Railway dashboard:

1. Select each service (backend, graphiti)
2. Click "Metrics" tab
3. View:
   - CPU usage
   - Memory usage
   - Network traffic
   - HTTP requests

**Set up alerts:**
1. Go to service → Settings → Notifications
2. Configure email alerts for high resource usage

### Error Tracking (Optional)

Add Sentry for automatic error reporting:

**Backend:**
```bash
cd backend
npm install @sentry/node
```

Add to `backend/server.js`:
```javascript
import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 1.0
});

// Add after all route definitions:
app.use(Sentry.Handlers.errorHandler());
```

Get a Sentry DSN at https://sentry.io

---

## Environment Variables Reference

### Frontend (Vercel)

| Variable | Example | Purpose |
|----------|---------|---------|
| `VITE_BACKEND_URL` | `https://backend.up.railway.app` | Backend API endpoint |
| `GEMINI_API_KEY` | `AIzaSy...` | Gemini AI voice chat |
| `NODE_ENV` | `production` | Build configuration |

### Backend (Railway)

| Variable | Example | Purpose |
|----------|---------|---------|
| `LINEAR_API_KEY` | `lin_api_xxx` | Linear project management |
| `NOTION_API_KEY` | `secret_xxx` | Notion page access |
| `OPENAI_API_KEY` | `sk-xxx` | OpenAI features |
| `GRAPHITI_SERVICE_URL` | `https://graphiti-service.up.railway.app` | Knowledge graph service |
| `CORS_ORIGIN` | `https://alfie.vercel.app` | Frontend URL for CORS |
| `SYNC_AUTH_TOKEN` | `<64-char-hex>` | Pieces sync authentication |
| `PORT` | Auto-assigned | Server port |
| `NODE_ENV` | `production` | Runtime mode |

### Graphiti Service (Railway)

| Variable | Example | Purpose |
|----------|---------|---------|
| `NEO4J_URI` | `neo4j+s://xxx.databases.neo4j.io:7687` | Database connection |
| `NEO4J_USER` | `neo4j` | Database username |
| `NEO4J_PASSWORD` | From Aura | Database password |
| `OPENAI_API_KEY` | `sk-xxx` | Embeddings and reasoning |
| `CORS_ORIGIN` | `https://backend.up.railway.app` | Backend URL |
| `PORT` | Auto-assigned | Service port |
| `PYTHONUNBUFFERED` | `1` | Logging output |

### Local Pieces Sync Script

Create `backend/.env.local` (not committed to Git):

| Variable | Example | Purpose |
|----------|---------|---------|
| `BACKEND_URL` | `https://backend.up.railway.app` | Cloud backend |
| `SYNC_AUTH_TOKEN` | `<64-char-hex>` | Same as Railway |
| `PIECES_SYNC_INTERVAL` | `1800000` | 30 minutes in ms |

---

## Troubleshooting Guide

### Issue: CORS Errors in Browser Console

**Symptom:** Error like "Access to XMLHttpRequest blocked by CORS policy"

**Solutions:**
1. Verify `CORS_ORIGIN` in Railway backend includes your Vercel URL
2. Ensure no trailing slashes in URLs
3. Redeploy backend after changing CORS:
   - Railway → backend → Redeploy
4. Check browser Network tab to see actual origin being sent
5. Wait 2-3 minutes after changing variables for Railway to pick up changes

### Issue: Frontend Still Uses Old API URL

**Symptom:** Frontend makes requests to `localhost:3002` instead of your Railway URL

**Solutions:**
1. Vercel embeds environment variables at build time
2. Trigger a new deployment:
   - Go to Vercel → Deployments
   - Click "Redeploy" on latest deployment
3. Or push a new commit to automatically trigger deployment
4. Clear browser cache (Cmd+Shift+R or Ctrl+Shift+R)

### Issue: Pieces Sync Script Not Running

**Symptom:** No workstream data in Briefing tab

**Solutions:**
1. Check if script is running:
   - PM2: `pm2 status` (should show "online")
   - systemd: `sudo systemctl status alfie-pieces-sync`
2. Check logs for errors:
   - PM2: `pm2 logs pieces-sync`
   - systemd: `sudo journalctl -u alfie-pieces-sync -f`
3. Verify Pieces OS is running:
   ```bash
   curl http://localhost:39300/health
   ```
   Should return a response
4. Verify token matches:
   - Check `SYNC_AUTH_TOKEN` in `backend/.env.local`
   - Matches what's set in Railway backend
5. Test manual sync:
   ```bash
   curl -X POST https://backend.up.railway.app/api/pieces/sync \
     -H "Authorization: Bearer your-token" \
     -H "Content-Type: application/json" \
     -d '{"data":[],"timestamp":"2025-01-15T10:00:00Z"}'
   ```

### Issue: Neo4j Connection Timeout

**Symptom:** Graphiti service fails to start, logs show connection errors

**Solutions:**
1. Verify Neo4j Aura instance is running:
   - Go to console.neo4j.io
   - Check instance is in "Running" state
2. Verify connection string uses secure protocol:
   - Must be `neo4j+s://` (not `neo4j://`)
3. Verify credentials are correct:
   - Double-check username and password
4. Test connection in Neo4j Browser first
5. Check Railway doesn't block port 7687:
   - May need to contact Railway support
6. Wait for Aura instance to fully initialize (2-3 minutes after creation)

### Issue: Railway Service Won't Start

**Symptom:** Deployment fails, service crashes, or shows error status

**Solutions:**
1. Check Railway deployment logs:
   - Click service → Deployments → View logs
2. Verify all required environment variables are set
3. Check start command is correct:
   - Backend: `npm start`
   - Graphiti: `python main.py`
4. Verify dependencies install:
   - Backend: `npm install`
   - Graphiti: Dependencies from `requirements.txt`
5. Test locally first:
   - Run backend locally with same env vars
   - Run Graphiti locally with same env vars
6. Check for syntax errors in code changes
7. Review full deployment logs for specific error messages

### Issue: Graph Visualization Not Rendering

**Symptom:** Context tab shows no graph or blank page

**Solutions:**
1. Check browser console for JavaScript errors
2. Verify Graphiti service is responding:
   ```bash
   curl https://graphiti-service.up.railway.app/health
   ```
3. Check Neo4j is connected:
   ```bash
   curl https://graphiti-service.up.railway.app/nodes
   ```
4. Try adding a conversation to graph (should trigger data fetch)
5. Check Network tab in DevTools for failed requests
6. Wait a few seconds for graph to load (initial fetch may be slow)

---

## Cost Estimate

### Free Tier (Recommended to Start)

| Service | Cost | Details |
|---------|------|---------|
| Railway | $0 | $5 monthly credit covers backend + Graphiti |
| Vercel | $0 | 100GB bandwidth free tier |
| Neo4j Aura Free | $0 | 1GB storage, fully free |
| Gemini API | $0-10 | First 1500 requests/day free |
| Linear API | $0 | Included with Linear plan |
| Notion API | $0 | Included with Notion plan |
| OpenAI API | $5-20 | Token-based, for graph embeddings |

**Total: $5-30/month** (within free tiers)

### If You Exceed Free Tiers

| Tier | Cost | When |
|------|------|------|
| Railway Starter | $20/month | If exceeding $5 credit |
| Vercel Pro | $20/month | If exceeding 100GB bandwidth |
| Neo4j Aura Pro | $65/month | If exceeding 1GB (8GB included) |

---

## Implementation Checklist

### Pre-Deployment Code Changes
- [ ] Replace hardcoded URLs in frontend (3 files)
- [ ] Update CORS configuration in backend
- [ ] Implement Pieces sync endpoint in backend
- [ ] Modify Pieces API endpoints to use data store
- [ ] Create pieces-sync-script.js
- [ ] Update Graphiti CORS configuration
- [ ] Add node-fetch dependency
- [ ] Commit all changes to GitHub

### Database Setup
- [ ] Create Neo4j Aura account
- [ ] Create free tier database
- [ ] Save connection credentials securely
- [ ] Test Neo4j connection

### Railway Deployment
- [ ] Deploy Graphiti service first
- [ ] Set all environment variables for Graphiti
- [ ] Verify Graphiti health check passes
- [ ] Save Graphiti public URL
- [ ] Deploy Backend service
- [ ] Set all environment variables for backend
- [ ] Verify backend health check passes
- [ ] Save backend public URL
- [ ] Update Graphiti CORS_ORIGIN with backend URL

### Vercel Deployment
- [ ] Import project from GitHub
- [ ] Configure Vite framework settings
- [ ] Set environment variables
- [ ] Deploy
- [ ] Save Vercel URL
- [ ] Update backend CORS_ORIGIN with Vercel URL
- [ ] Redeploy backend

### Pieces OS Sync Setup
- [ ] Create backend/.env.local with sync configuration
- [ ] Install PM2 or set up systemd service
- [ ] Start pieces-sync-script.js
- [ ] Verify initial sync succeeded
- [ ] Check data appears in Briefing tab

### Testing
- [ ] Component tests (health checks)
- [ ] End-to-end tests (all tabs)
- [ ] Browser console (no errors)
- [ ] Network tab (no failed requests)
- [ ] Pieces sync working
- [ ] Knowledge graph populated

### Monitoring
- [ ] Set up UptimeRobot monitors
- [ ] Configure email alerts
- [ ] Review Railway metrics
- [ ] Set up Railway notifications (optional)

---

## Quick Start Summary

**Total time: 3-5 hours**

1. **Code (60 min):** Make 6 file changes, add sync script
2. **Database (15 min):** Create Neo4j Aura instance
3. **Railway (90 min):** Deploy 2 services, configure env vars
4. **Vercel (30 min):** Deploy frontend, add env vars
5. **Pieces Sync (30 min):** Configure local sync script
6. **Testing (45 min):** Validate all components
7. **Monitoring (20 min):** Set up uptime checks

**Result:** Production-ready deployment with automatic data sync and monitoring!

---

## Support & Resources

- **Railway Docs:** https://docs.railway.app
- **Vercel Docs:** https://vercel.com/docs
- **Neo4j Docs:** https://neo4j.com/docs
- **Gemini API:** https://ai.google.dev
- **OpenAI API:** https://platform.openai.com/docs

---

**Questions?** Refer to the Troubleshooting Guide or deployment plan file at `/home/claydonjon/.claude/plans/wondrous-toasting-adleman.md`
