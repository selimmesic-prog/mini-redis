// Statistics controller

const { sendJSON, sendError } = require('../middleware');

/**
 * Get stats
 */
async function getStats(req, res, redis) {
    try {
        const stats = await redis.stats();
        sendJSON(res, 200, stats);
    } catch (err) {
        sendError(res, 500, err.message);
    }
}

module.exports = {
    getStats
};
