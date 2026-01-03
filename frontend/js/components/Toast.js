function Toast({ message, type }) {
    return (
        <div className={`toast ${type}`}>
            <span>{type === 'success' ? '✓' : '✕'}</span>
            <span>{message}</span>
        </div>
    );
}
