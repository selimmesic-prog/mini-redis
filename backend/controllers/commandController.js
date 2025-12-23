// Command execution controller

const { sendJSON, sendError, parseBody } = require('../middleware');

/**
 * Execute raw command
 */
async function executeCommand(req, res, redis) {
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

module.exports = {
    executeCommand
};
