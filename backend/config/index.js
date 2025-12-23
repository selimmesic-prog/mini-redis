// Configuration settings for the Mini-Redis API Server

module.exports = {
    HTTP_PORT: 3001,
    REDIS_HOST: 'localhost',
    REDIS_PORT: 6379,
    SOCKET_TIMEOUT: 5000,
    MAX_PAYLOAD_SIZE: 1e6 // 1MB
};
