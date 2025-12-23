// TCP Client - Communicates with Mini-Redis C Engine

const net = require('net');
const config = require('../config');

class RedisClient {
    constructor(host = config.REDIS_HOST, port = config.REDIS_PORT) {
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

            socket.setTimeout(config.SOCKET_TIMEOUT);

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

module.exports = RedisClient;
