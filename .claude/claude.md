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
├── backend/          # Node.js Express API (middleware)
├── frontend/         # React dashboard (single HTML file)
├── mcp-server/       # Jira MCP integration for Claude Code
└── start.sh          # Startup script for all services
```

## MCP Server (Jira Integration)

The project includes an MCP server that integrates Jira with Claude Code, allowing ticket lookup during development.

### Available Tools
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

The `.mcp.json` file is gitignored - each developer configures their own credentials locally.

## Key Commands

### Running the Project
```bash
# Build and run C engine
cd engine && make clean && make && ./mini-redis 6379

# Run Node.js backend
cd backend && node server.js

# Serve frontend
cd frontend && python3 -m http.server 8080
```

### Supported Redis Commands
- `PING` - Health check
- `SET key value` - Store key-value
- `GET key` - Retrieve value
- `DEL key` - Delete key
- `KEYS` - List all keys
- `STATS` - Memory statistics
- `QUIT` - Close connection

## API Endpoints (Backend :3001)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/stats` | Memory stats |
| GET | `/api/keys` | List all keys |
| GET | `/api/keys/:key` | Get key value |
| POST | `/api/keys` | Create key |
| PUT | `/api/keys/:key` | Update key |
| DELETE | `/api/keys/:key` | Delete key |
| POST | `/api/command` | Raw command |

## Technical Notes

- **Hash Table**: DJB2 hash, chaining for collisions, auto-resize at 0.75 load factor
- **Protocol**: Text-based, newline-terminated commands over TCP
- **Single-threaded**: Engine handles one client at a time (MVP)
