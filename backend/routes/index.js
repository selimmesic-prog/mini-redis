// Routes configuration

const healthController = require('../controllers/healthController');
const keysController = require('../controllers/keysController');
const statsController = require('../controllers/statsController');
const commandController = require('../controllers/commandController');

/**
 * Define all routes with their handlers
 */
const routes = {
    'GET /api/health': healthController.healthCheck,
    'GET /api/keys': keysController.getAllKeys,
    'GET /api/keys/all': keysController.getAllKeysWithValues,
    'GET /api/keys/:key': keysController.getKey,
    'POST /api/keys': keysController.setKey,
    'PUT /api/keys/:key': keysController.updateKey,
    'DELETE /api/keys/:key': keysController.deleteKey,
    'GET /api/stats': statsController.getStats,
    'POST /api/command': commandController.executeCommand
};

/**
 * Match a route based on method and pathname
 * @param {string} method - HTTP method
 * @param {string} pathname - URL pathname
 * @returns {Object|null} - { handler, params } or null
 */
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

module.exports = {
    routes,
    matchRoute
};
