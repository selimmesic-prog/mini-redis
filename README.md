# Mini-Redis

A custom in-memory key-value store written in C, with a Node.js middleware API and React dashboard.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Mini-Redis Architecture                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ┌──────────────┐      ┌──────────────┐      ┌──────────────┐              │
│   │   Frontend   │      │   Backend    │      │   C Engine   │              │
│   │   (React)    │◄────►│  (Node.js)   │◄────►│ (TCP Server) │              │
│   │              │ REST │              │ TCP  │              │              │
│   │  Dashboard   │ API  │   Express    │      │  Hash Table  │              │
│   └──────────────┘      └──────────────┘      └──────────────┘              │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Features

### C Engine
- Custom hash table implementation with collision handling (chaining)
- Dynamic resizing based on load factor
- Memory tracking and statistics
- TCP socket server with IPv6 dual-stack support
- Buffer overflow protection
- Graceful signal handling

### Supported Commands
| Command | Description | Response |
|---------|-------------|----------|
| `PING` | Health check | `PONG` |
| `SET key value` | Store a key-value pair | `OK` |
| `GET key` | Retrieve a value | Value or `NULL` |
| `DEL key` | Delete a key | `OK` or `NOT FOUND` |
| `KEYS` | List all keys | JSON array |
| `STATS` | Get memory statistics | JSON object |
| `QUIT` | Close connection | `BYE` |

### Node.js Middleware
- REST API bridge to the C engine
- CORS enabled
- JSON request/response handling
- Environment-based configuration
- Raw command execution

### React Dashboard
- Dark mode UI
- Real-time statistics
- Key browser with search
- Interactive console
- CRUD operations for keys

## Project Structure

```
mini-redis/
├── engine/                 # C Engine
│   ├── mini_redis.h       # Header file
│   ├── hash_table.c       # Hash table implementation
│   ├── server.c           # TCP server (IPv4/IPv6 dual-stack)
│   ├── Makefile           # Build configuration
│   └── Dockerfile         # Docker config for deployment
├── backend/               # Node.js Middleware
│   ├── server.js          # HTTP server
│   ├── config/            # Configuration (env vars)
│   ├── client/            # Redis TCP client
│   ├── controllers/       # Route handlers
│   ├── middleware/        # CORS, logging
│   ├── routes/            # API routes
│   └── package.json       # Node dependencies
├── frontend/              # React Frontend
│   ├── index.html         # Main dashboard
│   ├── css/               # Styles
│   └── js/                # React components & API
├── mcp-server/            # Jira MCP integration
├── start.sh               # Local startup script
└── README.md              # This file
```

## Quick Start

### Option 1: Use the Startup Script

```bash
./start.sh --local
```

This builds and starts all three services automatically.

### Option 2: Manual Setup

#### 1. Build and Start the C Engine

```bash
cd engine
make clean && make
./mini-redis 6379
```

#### 2. Start the Node.js Backend

```bash
cd backend
node server.js
```

#### 3. Serve the Frontend

```bash
cd frontend
python3 -m http.server 8080
```

Then visit: http://localhost:8080

## Deployment (Railway)

The project is configured for [Railway](https://railway.app) deployment.

### Setup

1. Push your code to GitHub
2. In Railway, create a new project from your GitHub repo
3. Add 3 services from the same repo with different root directories:

| Service | Root Directory | Type |
|---------|----------------|------|
| engine | `/engine` | Dockerfile |
| backend | `/backend` | Node.js |
| frontend | `/frontend` | Node.js (static) |

4. Set backend environment variables:
```
REDIS_HOST=engine.railway.internal
REDIS_PORT=8080
```

5. Generate public domains for frontend and backend services

### Environment Variables

The backend uses these environment variables (with defaults for local development):

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | HTTP server port | `3001` |
| `REDIS_HOST` | Engine hostname | `localhost` |
| `REDIS_PORT` | Engine port | `6379` |

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/health` | Health check |
| `GET` | `/api/stats` | Memory statistics |
| `GET` | `/api/keys` | List all keys |
| `GET` | `/api/keys/all` | Get all keys with values |
| `GET` | `/api/keys/:key` | Get specific key |
| `POST` | `/api/keys` | Create key `{key, value}` |
| `PUT` | `/api/keys/:key` | Update key `{value}` |
| `DELETE` | `/api/keys/:key` | Delete key |
| `POST` | `/api/command` | Raw command `{command}` |

## Testing with curl

```bash
# Health check
curl http://localhost:3001/api/health

# Create a key
curl -X POST http://localhost:3001/api/keys \
  -H "Content-Type: application/json" \
  -d '{"key":"user:1","value":"Alice"}'

# Get a key
curl http://localhost:3001/api/keys/user:1

# Get stats
curl http://localhost:3001/api/stats

# Execute raw command
curl -X POST http://localhost:3001/api/command \
  -H "Content-Type: application/json" \
  -d '{"command":"PING"}'

# Delete a key
curl -X DELETE http://localhost:3001/api/keys/user:1
```

## Testing with netcat

```bash
# Direct TCP connection to C engine
echo "PING" | nc localhost 6379
echo "SET name Claude" | nc localhost 6379
echo "GET name" | nc localhost 6379
echo "STATS" | nc localhost 6379
echo "KEYS" | nc localhost 6379
```

## Technical Details

### Hash Table Implementation
- Uses DJB2 hash function
- Collision resolution via chaining (linked lists)
- Automatic resizing when load factor > 0.75
- Memory tracking for all allocations

### Memory Management
- Manual allocation with `malloc`/`free`
- Tracked memory includes:
  - Hash table structure
  - Bucket array
  - Entry nodes
  - Key and value strings

### Network Protocol
- Simple text-based protocol
- Commands terminated by newline (`\n`)
- Responses terminated by newline
- IPv6 dual-stack support for cloud deployments
- Single-threaded for MVP (handles one client at a time)

## Configuration

### C Engine
Edit `mini_redis.h`:
```c
#define DEFAULT_PORT 6379
#define INITIAL_BUCKETS 64
#define LOAD_FACTOR_THRESHOLD 0.75
#define MAX_KEY_SIZE 256
#define MAX_VALUE_SIZE 4096
```

### Node.js Backend
Configuration via environment variables or `backend/config/index.js`:
```javascript
module.exports = {
    HTTP_PORT: process.env.PORT || 3001,
    REDIS_HOST: process.env.REDIS_HOST || 'localhost',
    REDIS_PORT: parseInt(process.env.REDIS_PORT, 10) || 6379,
};
```

## License

MIT License - Feel free to use for learning and portfolio projects.

## Author

Built as a portfolio project demonstrating:
- Low-level C programming
- TCP socket networking (IPv4/IPv6)
- Data structure implementation
- Full-stack development
- Cloud deployment
- System design
