// Configuration settings for the Mini-Redis API Server

module.exports = {
    HTTP_PORT: process.env.PORT || 3001,
    REDIS_HOST: process.env.REDIS_HOST || 'localhost',
    REDIS_PORT: parseInt(process.env.REDIS_PORT, 10) || 6379,
    SOCKET_TIMEOUT: 5000,
    MAX_PAYLOAD_SIZE: 1e6 // 1MB
};
