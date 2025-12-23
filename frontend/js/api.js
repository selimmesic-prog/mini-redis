const API_BASE = 'http://localhost:3001/api';

const api = {
    async health() {
        const res = await fetch(`${API_BASE}/health`);
        return res.json();
    },
    async stats() {
        const res = await fetch(`${API_BASE}/stats`);
        return res.json();
    },
    async keysAll() {
        const res = await fetch(`${API_BASE}/keys/all`);
        return res.json();
    },
    async set(key, value) {
        const res = await fetch(`${API_BASE}/keys`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key, value })
        });
        return res.json();
    },
    async update(key, value) {
        const res = await fetch(`${API_BASE}/keys/${encodeURIComponent(key)}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ value })
        });
        return res.json();
    },
    async del(key) {
        const res = await fetch(`${API_BASE}/keys/${encodeURIComponent(key)}`, {
            method: 'DELETE'
        });
        return res.json();
    },
    async command(cmd) {
        const res = await fetch(`${API_BASE}/command`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ command: cmd })
        });
        return res.json();
    }
};
