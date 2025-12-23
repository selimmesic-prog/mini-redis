// ============================================================================
// Mini-Redis Node.js Middleware
// Bridge between REST API and the C Engine via TCP
// ============================================================================

const http = require('http');
const net = require('net');
const url = require('url');

// Configuration
const CONFIG = {
    HTTP_PORT: 3001,
    REDIS_HOST: 'localhost',
    REDIS_PORT: 6379,
    SOCKET_TIMEOUT: 5000
};

// ============================================================================
// TCP Client - Communicates with C Engine
// ============================================================================
class RedisClient {
    constructor(host, port) {
        this.host = host;
        this.port = port;
    }

    /**
     * Send a command to the Mini-Redis server and get response
     * @param {string} command - The command to send (e.g., "GET key")
     * @returns {Promise<string>} - The response from the server
     */
    sendCommand(command) {
        return new Promise((resolve, reject) => {
            const socket = new net.Socket();
            let response = '';

            socket.setTimeout(CONFIG.SOCKET_TIMEOUT);

            socket.on('connect', () => {
                // Send command with newline
                socket.write(command + '\n');
            });

            socket.on('data', (data) => {
                response += data.toString();
                // Check if we received a complete response (ends with newline)
                if (response.endsWith('\n')) {
                    socket.destroy();
                    resolve(response.trim());
                }
            });

            socket.on('timeout', () => {
                socket.destroy();
                reject(new Error('Connection timeout'));
            });

            socket.on('error', (err) => {
                reject(new Error(`Connection error: ${err.message}`));
            });

            socket.on('close', () => {
                if (response) {
                    resolve(response.trim());
                }
            });

            socket.connect(this.port, this.host);
        });
    }

    // Convenience methods
    async ping() {
        return this.sendCommand('PING');
    }

    async get(key) {
        return this.sendCommand(`GET ${key}`);
    }

    async set(key, value) {
        return this.sendCommand(`SET ${key} ${value}`);
    }

    async del(key) {
        return this.sendCommand(`DEL ${key}`);
    }

    async keys() {
        const response = await this.sendCommand('KEYS');
        try {
            return JSON.parse(response);
        } catch {
            return [];
        }
    }

    async stats() {
        const response = await this.sendCommand('STATS');
        try {
            return JSON.parse(response);
        } catch {
            return { keys: 0, memory_bytes: 0 };
        }
    }
}

// Create Redis client instance
const redis = new RedisClient(CONFIG.REDIS_HOST, CONFIG.REDIS_PORT);

// ============================================================================
// HTTP Server - REST API
// ============================================================================

// CORS headers
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json'
};

/**
 * Parse JSON body from request
 */
function parseBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
            // Prevent too large payloads
            if (body.length > 1e6) {
                req.destroy();
                reject(new Error('Payload too large'));
            }
        });
        req.on('end', () => {
            try {
                resolve(body ? JSON.parse(body) : {});
            } catch (e) {
                reject(new Error('Invalid JSON'));
            }
        });
        req.on('error', reject);
    });
}

/**
 * Send JSON response
 */
function sendJSON(res, statusCode, data) {
    res.writeHead(statusCode, corsHeaders);
    res.end(JSON.stringify(data));
}

/**
 * Send error response
 */
function sendError(res, statusCode, message) {
    sendJSON(res, statusCode, { error: message });
}

/**
 * Log request
 */
function logRequest(method, path, status) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${method} ${path} - ${status}`);
}

// ============================================================================
// Route Handlers
// ============================================================================

const routes = {
    // Health check
    'GET /api/health': async (req, res) => {
        try {
            const pong = await redis.ping();
            sendJSON(res, 200, { 
                status: 'ok', 
                redis: pong === 'PONG' ? 'connected' : 'error',
                timestamp: new Date().toISOString()
            });
        } catch (err) {
            sendJSON(res, 200, { 
                status: 'ok', 
                redis: 'disconnected',
                error: err.message,
                timestamp: new Date().toISOString()
            });
        }
    },

    // Get all keys
    'GET /api/keys': async (req, res) => {
        try {
            const keys = await redis.keys();
            sendJSON(res, 200, { keys });
        } catch (err) {
            sendError(res, 500, err.message);
        }
    },

    // Get all keys with values
    'GET /api/keys/all': async (req, res) => {
        try {
            const keys = await redis.keys();
            const entries = [];
            
            for (const key of keys) {
                const value = await redis.get(key);
                entries.push({ key, value: value === 'NULL' ? null : value });
            }
            
            sendJSON(res, 200, { entries });
        } catch (err) {
            sendError(res, 500, err.message);
        }
    },

    // Get a specific key
    'GET /api/keys/:key': async (req, res, params) => {
        try {
            const value = await redis.get(params.key);
            if (value === 'NULL') {
                sendError(res, 404, 'Key not found');
            } else {
                sendJSON(res, 200, { key: params.key, value });
            }
        } catch (err) {
            sendError(res, 500, err.message);
        }
    },

    // Set a key
    'POST /api/keys': async (req, res) => {
        try {
            const body = await parseBody(req);
            
            if (!body.key || body.value === undefined) {
                sendError(res, 400, 'Missing key or value');
                return;
            }
            
            const result = await redis.set(body.key, body.value);
            if (result === 'OK') {
                sendJSON(res, 201, { success: true, key: body.key, value: body.value });
            } else {
                sendError(res, 500, result);
            }
        } catch (err) {
            sendError(res, 500, err.message);
        }
    },

    // Update a key (PUT)
    'PUT /api/keys/:key': async (req, res, params) => {
        try {
            const body = await parseBody(req);
            
            if (body.value === undefined) {
                sendError(res, 400, 'Missing value');
                return;
            }
            
            const result = await redis.set(params.key, body.value);
            if (result === 'OK') {
                sendJSON(res, 200, { success: true, key: params.key, value: body.value });
            } else {
                sendError(res, 500, result);
            }
        } catch (err) {
            sendError(res, 500, err.message);
        }
    },

    // Delete a key
    'DELETE /api/keys/:key': async (req, res, params) => {
        try {
            const result = await redis.del(params.key);
            if (result === 'OK') {
                sendJSON(res, 200, { success: true, deleted: params.key });
            } else if (result === 'NOT FOUND') {
                sendError(res, 404, 'Key not found');
            } else {
                sendError(res, 500, result);
            }
        } catch (err) {
            sendError(res, 500, err.message);
        }
    },

    // Get stats
    'GET /api/stats': async (req, res) => {
        try {
            const stats = await redis.stats();
            sendJSON(res, 200, stats);
        } catch (err) {
            sendError(res, 500, err.message);
        }
    },

    // Execute raw command
    'POST /api/command': async (req, res) => {
        try {
            const body = await parseBody(req);
            
            if (!body.command) {
                sendError(res, 400, 'Missing command');
                return;
            }
            
            const response = await redis.sendCommand(body.command);
            sendJSON(res, 200, { command: body.command, response });
        } catch (err) {
            sendError(res, 500, err.message);
        }
    }
};

// ============================================================================
// Router
// ============================================================================

function matchRoute(method, pathname) {
    for (const [routeKey, handler] of Object.entries(routes)) {
        const [routeMethod, routePath] = routeKey.split(' ');
        
        if (method !== routeMethod) continue;
        
        // Check for exact match
        if (routePath === pathname) {
            return { handler, params: {} };
        }
        
        // Check for parameterized routes
        const routeParts = routePath.split('/');
        const pathParts = pathname.split('/');
        
        if (routeParts.length !== pathParts.length) continue;
        
        const params = {};
        let match = true;
        
        for (let i = 0; i < routeParts.length; i++) {
            if (routeParts[i].startsWith(':')) {
                // This is a parameter
                params[routeParts[i].slice(1)] = decodeURIComponent(pathParts[i]);
            } else if (routeParts[i] !== pathParts[i]) {
                match = false;
                break;
            }
        }
        
        if (match) {
            return { handler, params };
        }
    }
    
    return null;
}

// ============================================================================
// Create and Start Server
// ============================================================================

const server = http.createServer(async (req, res) => {
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;
    const method = req.method;

    // Handle CORS preflight
    if (method === 'OPTIONS') {
        res.writeHead(204, corsHeaders);
        res.end();
        return;
    }

    // Match route
    const route = matchRoute(method, pathname);
    
    if (route) {
        try {
            await route.handler(req, res, route.params);
            logRequest(method, pathname, res.statusCode);
        } catch (err) {
            console.error(`Error handling ${method} ${pathname}:`, err);
            sendError(res, 500, 'Internal server error');
            logRequest(method, pathname, 500);
        }
    } else {
        sendError(res, 404, 'Not found');
        logRequest(method, pathname, 404);
    }
});

server.listen(CONFIG.HTTP_PORT, () => {
    console.log('===========================================');
    console.log('  Mini-Redis API Server                   ');
    console.log('===========================================');
    console.log(`HTTP API listening on port ${CONFIG.HTTP_PORT}`);
    console.log(`Redis connection: ${CONFIG.REDIS_HOST}:${CONFIG.REDIS_PORT}`);
    console.log('');
    console.log('Available endpoints:');
    console.log('  GET    /api/health      - Health check');
    console.log('  GET    /api/stats       - Get memory stats');
    console.log('  GET    /api/keys        - List all keys');
    console.log('  GET    /api/keys/all    - Get all keys with values');
    console.log('  GET    /api/keys/:key   - Get a specific key');
    console.log('  POST   /api/keys        - Set a key {key, value}');
    console.log('  PUT    /api/keys/:key   - Update a key {value}');
    console.log('  DELETE /api/keys/:key   - Delete a key');
    console.log('  POST   /api/command     - Execute raw command {command}');
    console.log('');
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\nShutting down...');
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});

process.on('SIGTERM', () => {
    console.log('\nShutting down...');
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});
