const { useState, useEffect, useRef, useCallback } = React;

function Dashboard() {
    const [connected, setConnected] = useState(false);
    const [entries, setEntries] = useState([]);
    const [stats, setStats] = useState({ keys: 0, memory_bytes: 0 });
    const [selectedKey, setSelectedKey] = useState(null);
    const [activeTab, setActiveTab] = useState('editor');
    const [searchTerm, setSearchTerm] = useState('');
    const [consoleLogs, setConsoleLogs] = useState([]);
    const [consoleInput, setConsoleInput] = useState('');
    const [editKey, setEditKey] = useState('');
    const [editValue, setEditValue] = useState('');
    const [isNewKey, setIsNewKey] = useState(false);
    const [toasts, setToasts] = useState([]);
    const consoleRef = useRef(null);

    const addToast = (message, type = 'success') => {
        const id = Date.now();
        setToasts(prev => [...prev, { id, message, type }]);
    };

    const removeToast = (id) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    };

    const addLog = (cmd, response, isError = false) => {
        const time = new Date().toLocaleTimeString('en-US', { hour12: false });
        setConsoleLogs(prev => [...prev, { time, cmd, response, isError }]);
        setTimeout(() => {
            if (consoleRef.current) {
                consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
            }
        }, 100);
    };

    const fetchData = useCallback(async () => {
        try {
            const [healthData, statsData, entriesData] = await Promise.all([
                api.health(),
                api.stats(),
                api.keysAll()
            ]);
            setConnected(healthData.redis === 'connected');
            setStats(statsData);
            setEntries(entriesData.entries || []);
        } catch (err) {
            setConnected(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 2000);
        return () => clearInterval(interval);
    }, [fetchData]);

    const handleSelectKey = (entry) => {
        setSelectedKey(entry.key);
        setEditKey(entry.key);
        setEditValue(entry.value || '');
        setIsNewKey(false);
        setActiveTab('editor');
    };

    const handleNewKey = () => {
        setSelectedKey(null);
        setEditKey('');
        setEditValue('');
        setIsNewKey(true);
        setActiveTab('editor');
    };

    const handleSave = async () => {
        if (!editKey.trim()) {
            addToast('Key cannot be empty', 'error');
            return;
        }
        try {
            if (isNewKey) {
                await api.set(editKey, editValue);
                addLog(`SET ${editKey} ${editValue}`, 'OK');
                addToast(`Key "${editKey}" created`);
            } else {
                await api.update(editKey, editValue);
                addLog(`SET ${editKey} ${editValue}`, 'OK');
                addToast(`Key "${editKey}" updated`);
            }
            await fetchData();
            setSelectedKey(editKey);
            setIsNewKey(false);
        } catch (err) {
            addToast('Failed to save', 'error');
        }
    };

    const handleDelete = async () => {
        if (!selectedKey) return;
        try {
            await api.del(selectedKey);
            addLog(`DEL ${selectedKey}`, 'OK');
            addToast(`Key "${selectedKey}" deleted`);
            setSelectedKey(null);
            setEditKey('');
            setEditValue('');
            await fetchData();
        } catch (err) {
            addToast('Failed to delete', 'error');
        }
    };

    const handleConsoleCommand = async (e) => {
        if (e.key !== 'Enter' || !consoleInput.trim()) return;
        const cmd = consoleInput.trim();
        setConsoleInput('');
        try {
            const result = await api.command(cmd);
            addLog(cmd, result.response);
            await fetchData();
        } catch (err) {
            addLog(cmd, err.message, true);
        }
    };

    const filteredEntries = entries.filter(e =>
        e.key.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const formatBytes = (bytes) => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    };

    return (
        <div className="dashboard">
            {/* Header */}
            <header className="header">
                <div className="logo">
                    <div className="logo-icon">⚡</div>
                    <div className="logo-text">Mini<span>Redis</span></div>
                </div>
                <div className="status-indicator">
                    <div className={`status-dot ${connected ? 'connected' : 'disconnected'}`}></div>
                    <span>{connected ? 'Connected' : 'Disconnected'}</span>
                </div>
            </header>

            {/* Sidebar - Keys List */}
            <aside className="sidebar">
                <div className="sidebar-header">
                    <div className="sidebar-title">Keys</div>
                    <div className="search-box">
                        <span className="search-icon">🔍</span>
                        <input
                            type="text"
                            placeholder="Search keys..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>
                <button className="add-key-btn" onClick={handleNewKey}>
                    + Add New Key
                </button>
                <div className="keys-list">
                    {filteredEntries.length === 0 ? (
                        <div className="empty-state">
                            <div className="empty-icon">📦</div>
                            <div>No keys found</div>
                        </div>
                    ) : (
                        filteredEntries.map(entry => (
                            <div
                                key={entry.key}
                                className={`key-item ${selectedKey === entry.key ? 'selected' : ''}`}
                                onClick={() => handleSelectKey(entry)}
                            >
                                <div className="key-icon">🔑</div>
                                <div className="key-info">
                                    <div className="key-name">{entry.key}</div>
                                    <div className="key-preview">{entry.value?.substring(0, 30) || '(empty)'}</div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </aside>

            {/* Main Content */}
            <main className="main-content">
                <div className="tab-bar">
                    <div
                        className={`tab ${activeTab === 'editor' ? 'active' : ''}`}
                        onClick={() => setActiveTab('editor')}
                    >
                        Editor
                    </div>
                    <div
                        className={`tab ${activeTab === 'console' ? 'active' : ''}`}
                        onClick={() => setActiveTab('console')}
                    >
                        Console
                    </div>
                </div>

                <div className="content-area">
                    {activeTab === 'editor' ? (
                        <div className="editor-panel fade-in">
                            <div className="editor-header">
                                <div className="editor-title">
                                    {isNewKey ? 'New Key' : (selectedKey || 'Select a key')}
                                </div>
                                <div className="editor-actions">
                                    {selectedKey && !isNewKey && (
                                        <button className="btn btn-danger btn-sm" onClick={handleDelete}>
                                            Delete
                                        </button>
                                    )}
                                </div>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Key</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    placeholder="Enter key name..."
                                    value={editKey}
                                    onChange={e => setEditKey(e.target.value)}
                                    disabled={!isNewKey && selectedKey}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Value</label>
                                <textarea
                                    className="form-input"
                                    placeholder="Enter value..."
                                    value={editValue}
                                    onChange={e => setEditValue(e.target.value)}
                                />
                            </div>
                            <div className="form-group">
                                <button className="btn btn-primary" onClick={handleSave}>
                                    {isNewKey ? 'Create Key' : 'Save Changes'}
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="console fade-in">
                            <div className="console-header">
                                <div className="console-title">
                                    <div className="console-dot"></div>
                                    Interactive Console
                                </div>
                                <button
                                    className="btn btn-secondary btn-sm"
                                    onClick={() => setConsoleLogs([])}
                                >
                                    Clear
                                </button>
                            </div>
                            <div className="console-output" ref={consoleRef}>
                                {consoleLogs.length === 0 ? (
                                    <div style={{color: 'var(--text-muted)'}}>
                                        Type a command below (PING, SET, GET, DEL, STATS, KEYS)
                                    </div>
                                ) : (
                                    consoleLogs.map((log, i) => (
                                        <div key={i} className="console-line">
                                            <span className="console-time">{log.time}</span>
                                            <span className="console-cmd">&gt; {log.cmd}</span>
                                        </div>
                                    )).concat(consoleLogs.map((log, i) => (
                                        <div key={`r-${i}`} className="console-line">
                                            <span className="console-time">&nbsp;</span>
                                            <span className={log.isError ? 'console-error' : 'console-response'}>
                                                {log.response}
                                            </span>
                                        </div>
                                    ))).reduce((acc, item, i) => {
                                        if (i % 2 === 0) acc.push([]);
                                        acc[acc.length - 1].push(item);
                                        return acc;
                                    }, []).flat()
                                )}
                            </div>
                            <div className="console-input-wrapper">
                                <span className="console-prompt">mini-redis&gt;</span>
                                <input
                                    type="text"
                                    className="console-input"
                                    placeholder="Enter command..."
                                    value={consoleInput}
                                    onChange={e => setConsoleInput(e.target.value)}
                                    onKeyDown={handleConsoleCommand}
                                />
                            </div>
                        </div>
                    )}
                </div>
            </main>

            {/* Stats Panel */}
            <aside className="stats-panel">
                <div className="stats-header">
                    <div className="stats-title">Statistics</div>
                </div>
                <div className="stats-content">
                    <div className="stat-card">
                        <div className="stat-label">Total Keys</div>
                        <div className="stat-value cyan">
                            {stats.keys}
                            <span className="stat-unit">keys</span>
                        </div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-label">Memory Usage</div>
                        <div className="stat-value green">
                            {formatBytes(stats.memory_bytes)}
                        </div>
                        <div className="memory-bar">
                            <div
                                className="memory-bar-fill"
                                style={{width: `${Math.min((stats.memory_bytes / 10240) * 100, 100)}%`}}
                            />
                        </div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-label">Connection Status</div>
                        <div className={`stat-value ${connected ? 'green' : 'orange'}`}>
                            {connected ? 'Online' : 'Offline'}
                        </div>
                    </div>
                </div>
                <div className="quick-actions">
                    <div className="quick-title">Quick Actions</div>
                    <button className="action-btn" onClick={handleNewKey}>
                        <div className="action-icon">➕</div>
                        <span>Add New Key</span>
                    </button>
                    <button className="action-btn" onClick={() => setActiveTab('console')}>
                        <div className="action-icon">💻</div>
                        <span>Open Console</span>
                    </button>
                    <button className="action-btn" onClick={fetchData}>
                        <div className="action-icon">🔄</div>
                        <span>Refresh Data</span>
                    </button>
                </div>
            </aside>

            {/* Toast Notifications */}
            <div className="toast-container">
                {toasts.map(toast => (
                    <Toast
                        key={toast.id}
                        message={toast.message}
                        type={toast.type}
                        onClose={() => removeToast(toast.id)}
                    />
                ))}
            </div>
        </div>
    );
}
