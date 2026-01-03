# Mini-Redis

A custom in-memory key-value store with a C engine, Node.js backend API, and React dashboard.

## Architecture

```
Frontend (React)  <--REST-->  Backend (Node.js)  <--TCP-->  Engine (C)
   :8080                         :3001                       :6379
```

## Project Structure

```
mini-redis/
├── engine/           # C TCP server with hash table implementation
│   ├── server.c      # TCP server (IPv4/IPv6 dual-stack)
│   ├── hash_table.c  # Hash table implementation
│   ├── mini_redis.h  # Header file
│   ├── Makefile      # Build configuration
│   └── Dockerfile    # Docker config for Railway deployment
├── backend/          # Node.js API (middleware)
│   ├── server.js     # HTTP server
│   ├── config/       # Configuration (uses env vars)
│   ├── client/       # Redis TCP client
│   ├── controllers/  # Route handlers
│   ├── middleware/   # CORS, logging, etc.
│   ├── routes/       # API route definitions
│   └── package.json  # Node dependencies
├── frontend/         # React dashboard
│   ├── index.html    # Main dashboard page
│   ├── css/          # Styles
│   └── js/           # React components & API client
├── mcp-server/       # Jira MCP integration for Claude Code
└── start.sh          # Local startup script
```

## Running Locally

```bash
# Option 1: Use the startup script
./start.sh --local

# Option 2: Run services manually
cd engine && make clean && make && ./mini-redis 6379
cd backend && node server.js
cd frontend && python3 -m http.server 8080
```

## Deployment (Railway)

The project is configured for Railway deployment with 3 services:

| Service | Root Directory | Port | Notes |
|---------|----------------|------|-------|
| engine | `/engine` | 8080 (Railway-assigned) | Uses Dockerfile, IPv6 enabled |
| backend | `/backend` | 8080 (Railway-assigned) | Node.js auto-detected |
| frontend | `/frontend` | 8080 (Railway-assigned) | Static site via `serve` |

### Backend Environment Variables
```
REDIS_HOST=engine.railway.internal
REDIS_PORT=8080
PORT=8080 (auto-set by Railway)
```

### Frontend API Configuration
`frontend/js/api.js` auto-detects environment:
- localhost → `http://localhost:3001/api`
- deployed → `https://backend-production-856a.up.railway.app/api`

## MCP Server (Jira Integration)

| Tool | Description |
|------|-------------|
| `jira_get_ticket` | Fetch ticket details by key (e.g., MINI-123) |
| `jira_get_comments` | Get comments/discussion on a ticket |
| `jira_search` | Search tickets using JQL queries |
| `jira_my_tickets` | Get tickets assigned to current user |

### Setup
1. Copy `.mcp.json.example` to `.mcp.json`
2. Add your Jira credentials (host, email, API token)
3. Restart Claude Code

## Supported Redis Commands

- `PING` - Health check
- `SET key value` - Store key-value
- `GET key` - Retrieve value
- `DEL key` - Delete key
- `KEYS` - List all keys
- `STATS` - Memory statistics
- `QUIT` - Close connection

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/stats` | Memory stats |
| GET | `/api/keys` | List all keys |
| GET | `/api/keys/all` | Get all keys with values |
| GET | `/api/keys/:key` | Get key value |
| POST | `/api/keys` | Create key |
| PUT | `/api/keys/:key` | Update key |
| DELETE | `/api/keys/:key` | Delete key |
| POST | `/api/command` | Raw command |

## Technical Notes

- **Hash Table**: DJB2 hash, chaining for collisions, auto-resize at 0.75 load factor
- **Protocol**: Text-based, newline-terminated commands over TCP
- **Networking**: IPv6 dual-stack support (required for Railway internal networking)
- **Single-threaded**: Engine handles one client at a time (MVP)
