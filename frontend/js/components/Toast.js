const { useEffect } = React;

function Toast({ message, type, onClose }) {
    useEffect(() => {
        const timer = setTimeout(onClose, 3000);
        return () => clearTimeout(timer);
    }, [onClose]);

    return (
        <div className={`toast ${type}`}>
            <span>{type === 'success' ? '✓' : '✕'}</span>
            <span>{message}</span>
        </div>
    );
}
