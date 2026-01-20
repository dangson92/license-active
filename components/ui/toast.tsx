import React, { createContext, useContext, useState, useCallback } from 'react';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface Toast {
    id: string;
    type: ToastType;
    title: string;
    message?: string;
    duration?: number;
}

interface ToastContextType {
    toasts: Toast[];
    addToast: (toast: Omit<Toast, 'id'>) => void;
    removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
};

// Convenience functions
export const toast = {
    success: (title: string, message?: string) => {
        console.log('[Toast] Dispatching success:', title);
        const event = new CustomEvent('add-toast', {
            detail: { type: 'success', title, message, duration: 5000 }
        });
        window.dispatchEvent(event);
    },
    error: (title: string, message?: string) => {
        console.log('[Toast] Dispatching error:', title);
        const event = new CustomEvent('add-toast', {
            detail: { type: 'error', title, message, duration: 7000 }
        });
        window.dispatchEvent(event);
    },
    info: (title: string, message?: string) => {
        console.log('[Toast] Dispatching info:', title);
        const event = new CustomEvent('add-toast', {
            detail: { type: 'info', title, message, duration: 5000 }
        });
        window.dispatchEvent(event);
    },
    warning: (title: string, message?: string) => {
        console.log('[Toast] Dispatching warning:', title);
        const event = new CustomEvent('add-toast', {
            detail: { type: 'warning', title, message, duration: 6000 }
        });
        window.dispatchEvent(event);
    },
};

const ToastIcon: React.FC<{ type: ToastType }> = ({ type }) => {
    switch (type) {
        case 'success':
            return <CheckCircle className="w-5 h-5 text-emerald-500" />;
        case 'error':
            return <AlertCircle className="w-5 h-5 text-red-500" />;
        case 'warning':
            return <AlertTriangle className="w-5 h-5 text-amber-500" />;
        default:
            return <Info className="w-5 h-5 text-blue-500" />;
    }
};

const ToastItem: React.FC<{ toast: Toast; onRemove: () => void }> = ({ toast, onRemove }) => {
    const bgColors = {
        success: 'bg-emerald-50 border-emerald-200',
        error: 'bg-red-50 border-red-200',
        warning: 'bg-amber-50 border-amber-200',
        info: 'bg-blue-50 border-blue-200',
    };

    return (
        <div
            className={`flex items-start gap-3 p-4 rounded-lg border shadow-lg animate-slide-in ${bgColors[toast.type]}`}
            style={{
                animation: 'slideIn 0.3s ease-out',
            }}
        >
            <ToastIcon type={toast.type} />
            <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 text-sm">{toast.title}</p>
                {toast.message && (
                    <p className="text-gray-600 text-xs mt-0.5">{toast.message}</p>
                )}
            </div>
            <button
                onClick={onRemove}
                className="text-gray-400 hover:text-gray-600 transition-colors"
            >
                <X className="w-4 h-4" />
            </button>
        </div>
    );
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const removeToast = useCallback((id: string) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    }, []);

    const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
        const id = Math.random().toString(36).substring(2, 9);
        const newToast: Toast = { ...toast, id };
        setToasts((prev) => [...prev, newToast]);

        // Auto remove after duration
        const duration = toast.duration || 5000;
        setTimeout(() => {
            removeToast(id);
        }, duration);
    }, [removeToast]);

    // Listen for global toast events
    React.useEffect(() => {
        const handler = (e: CustomEvent<Omit<Toast, 'id'>>) => {
            console.log('[Toast] Received event:', e.detail);
            addToast(e.detail);
        };
        window.addEventListener('add-toast', handler as EventListener);
        console.log('[Toast] Event listener attached');
        return () => {
            window.removeEventListener('add-toast', handler as EventListener);
            console.log('[Toast] Event listener removed');
        };
    }, [addToast]);

    return (
        <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
            {children}
            {/* Toast Container */}
            <div className="fixed bottom-4 right-4 z-[100] flex flex-col-reverse gap-2 max-w-sm w-full pointer-events-none">
                {toasts.map((t) => (
                    <div key={t.id} className="pointer-events-auto">
                        <ToastItem toast={t} onRemove={() => removeToast(t.id)} />
                    </div>
                ))}
            </div>
            {/* Animations */}
            <style>{`
                @keyframes slideIn {
                    from {
                        opacity: 0;
                        transform: translateX(100%);
                    }
                    to {
                        opacity: 1;
                        transform: translateX(0);
                    }
                }
            `}</style>
        </ToastContext.Provider>
    );
};

export default ToastProvider;
