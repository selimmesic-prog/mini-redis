// Keys management controller

const { sendJSON, sendError, parseBody } = require('../middleware');

/**
 * Get all keys
 */
async function getAllKeys(req, res, redis) {
    try {
        const keys = await redis.keys();
        sendJSON(res, 200, { keys });
    } catch (err) {
        sendError(res, 500, err.message);
    }
}

/**
 * Get all keys with values
 */
async function getAllKeysWithValues(req, res, redis) {
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
}

/**
 * Get a specific key
 */
async function getKey(req, res, redis, params) {
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
}

/**
 * Set a key
 */
async function setKey(req, res, redis) {
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
}

/**
 * Update a key (PUT)
 */
async function updateKey(req, res, redis, params) {
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
}

/**
 * Delete a key
 */
async function deleteKey(req, res, redis, params) {
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
}

module.exports = {
    getAllKeys,
    getAllKeysWithValues,
    getKey,
    setKey,
    updateKey,
    deleteKey
};
