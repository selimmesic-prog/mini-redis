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
│   │  Dashboard   │ API  │   Express    │ 6379 │  Hash Table  │              │
│   └──────────────┘      └──────────────┘      └──────────────┘              │
│       Port 8080            Port 3001            Port 6379                   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Features

### C Engine
- Custom hash table implementation with collision handling (chaining)
- Dynamic resizing based on load factor
- Memory tracking and statistics
- TCP socket server
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
│   ├── server.c           # TCP server & main
│   └── Makefile           # Build configuration
├── backend/               # Node.js Middleware
│   ├── server.js          # Express API server
│   └── package.json       # Node configuration
├── frontend/              # React Frontend
│   └── dashboard.html     # Single-file React app
├── start.sh               # Startup script
└── README.md              # This file
```

## Quick Start

### 1. Build the C Engine

```bash
cd engine
make clean && make
```

### 2. Start the C Engine

```bash
./mini-redis 6379
```

Output:
```
[2025-12-23 10:00:00] [INFO] ===========================================
[2025-12-23 10:00:00] [INFO]   Mini-Redis - In-Memory Key-Value Store  
[2025-12-23 10:00:00] [INFO] ===========================================
[2025-12-23 10:00:00] [INFO] Hash table initialized with 64 buckets
[2025-12-23 10:00:00] [INFO] Mini-Redis server started on port 6379
[2025-12-23 10:00:00] [INFO] Listening for connections...
```

### 3. Start the Node.js Backend

```bash
cd backend
node server.js
```

Output:
```
===========================================
  Mini-Redis API Server                   
===========================================
HTTP API listening on port 3001
Redis connection: localhost:6379
```

### 4. Open the Dashboard

Open `frontend/dashboard.html` in your browser, or serve it:

```bash
cd frontend
python3 -m http.server 8080
```

Then visit: http://localhost:8080/dashboard.html

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
Edit `server.js`:
```javascript
const CONFIG = {
    HTTP_PORT: 3001,
    REDIS_HOST: 'localhost',
    REDIS_PORT: 6379,
    SOCKET_TIMEOUT: 5000
};
```

## License

MIT License - Feel free to use for learning and portfolio projects.

## Author

Built as a portfolio project demonstrating:
- Low-level C programming
- TCP socket networking
- Data structure implementation
- Full-stack development
- System design
