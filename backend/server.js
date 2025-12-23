// ============================================================================
// Mini-Redis Node.js Middleware
// Bridge between REST API and the C Engine via TCP
// ============================================================================

const http = require('http');
const url = require('url');
const config = require('./config');
const RedisClient = require('./client/RedisClient');
const { corsHeaders, sendError, logRequest } = require('./middleware');
const { matchRoute } = require('./routes');

// Create Redis client instance
const redis = new RedisClient();

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
            await route.handler(req, res, redis, route.params);
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

server.listen(config.HTTP_PORT, () => {
    console.log('===========================================');
    console.log('  Mini-Redis API Server                   ');
    console.log('===========================================');
    console.log(`HTTP API listening on port ${config.HTTP_PORT}`);
    console.log(`Redis connection: ${config.REDIS_HOST}:${config.REDIS_PORT}`);
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
