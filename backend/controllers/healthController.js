// Health check controller

const { sendJSON } = require('../middleware');

/**
 * Health check endpoint
 */
async function healthCheck(req, res, redis) {
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
}

module.exports = {
    healthCheck
};
