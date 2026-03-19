'use client';

import { useState, useEffect, createContext, useContext, useCallback, ReactNode } from 'react';
import { X, CheckCircle, AlertTriangle, Info, XCircle } from 'lucide-react';

// ============ TOAST SYSTEM ============

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
    id: string;
    message: string;
    type: ToastType;
    duration?: number;
}

interface ConfirmOptions {
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    variant?: 'danger' | 'warning' | 'primary';
    onConfirm: () => void | Promise<void>;
}

interface UIContextType {
    showToast: (message: string, type?: ToastType, duration?: number) => void;
    showConfirm: (options: ConfirmOptions) => void;
}

const UIContext = createContext<UIContextType>({
    showToast: () => {},
    showConfirm: () => {},
});

export const useUI = () => useContext(UIContext);

const ICONS: Record<ToastType, ReactNode> = {
    success: <CheckCircle className="w-5 h-5 text-emerald-500" />,
    error: <XCircle className="w-5 h-5 text-red-500" />,
    warning: <AlertTriangle className="w-5 h-5 text-amber-500" />,
    info: <Info className="w-5 h-5 text-blue-500" />,
};

const BG: Record<ToastType, string> = {
    success: 'border-emerald-500/30 bg-emerald-50 dark:bg-emerald-950/40',
    error: 'border-red-500/30 bg-red-50 dark:bg-red-950/40',
    warning: 'border-amber-500/30 bg-amber-50 dark:bg-amber-950/40',
    info: 'border-blue-500/30 bg-blue-50 dark:bg-blue-950/40',
};

export function UIProvider({ children }: { children: ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([]);
    const [confirm, setConfirm] = useState<ConfirmOptions | null>(null);
    const [confirming, setConfirming] = useState(false);

    const showToast = useCallback((message: string, type: ToastType = 'info', duration = 4000) => {
        const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        setToasts(prev => [...prev, { id, message, type, duration }]);
    }, []);

    const removeToast = useCallback((id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    const showConfirm = useCallback((options: ConfirmOptions) => {
        setConfirm(options);
        setConfirming(false);
    }, []);

    const handleConfirm = async () => {
        if (!confirm || confirming) return;
        setConfirming(true);
        try {
            await confirm.onConfirm();
        } catch { }
        setConfirming(false);
        setConfirm(null);
    };

    const variantStyles: Record<string, string> = {
        danger: 'bg-red-600 hover:bg-red-700',
        warning: 'bg-amber-600 hover:bg-amber-700',
        primary: 'bg-brand-primary hover:brightness-110',
    };

    return (
        <UIContext.Provider value={{ showToast, showConfirm }}>
            {children}

            {/* ======== TOAST STACK ======== */}
            <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none" style={{ maxWidth: '400px' }}>
                {toasts.map(toast => (
                    <ToastItem key={toast.id} toast={toast} onRemove={removeToast} />
                ))}
            </div>

            {/* ======== CONFIRM MODAL ======== */}
            {confirm && (
                <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
                    <div className="bg-brand-surface border border-brand-border rounded-2xl shadow-card-hover max-w-md w-full animate-slide-up overflow-hidden">
                        <div className="p-6">
                            <div className="flex items-start gap-3 mb-4">
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                                    confirm.variant === 'danger' ? 'bg-red-100 dark:bg-red-950' :
                                    confirm.variant === 'warning' ? 'bg-amber-100 dark:bg-amber-950' :
                                    'bg-blue-100 dark:bg-blue-950'
                                }`}>
                                    {confirm.variant === 'danger' ? <AlertTriangle className="w-5 h-5 text-red-600" /> :
                                     confirm.variant === 'warning' ? <AlertTriangle className="w-5 h-5 text-amber-600" /> :
                                     <Info className="w-5 h-5 text-blue-600" />}
                                </div>
                                <div>
                                    <h3 className="text-base font-semibold text-brand-text-primary">{confirm.title}</h3>
                                    <p className="text-sm text-brand-text-muted mt-1 leading-relaxed">{confirm.message}</p>
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-3 px-6 pb-6">
                            <button
                                onClick={() => setConfirm(null)}
                                disabled={confirming}
                                className="flex-1 py-2.5 px-4 rounded-xl text-sm font-medium bg-brand-surface-2 text-brand-text-primary hover:bg-brand-surface-3 transition-all disabled:opacity-50"
                            >
                                {confirm.cancelText || 'Hủy'}
                            </button>
                            <button
                                onClick={handleConfirm}
                                disabled={confirming}
                                className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-medium text-white transition-all disabled:opacity-50 ${variantStyles[confirm.variant || 'primary']}`}
                            >
                                {confirming ? 'Đang xử lý...' : (confirm.confirmText || 'Xác nhận')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </UIContext.Provider>
    );
}

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: (id: string) => void }) {
    const [visible, setVisible] = useState(false);
    const [exiting, setExiting] = useState(false);

    useEffect(() => {
        requestAnimationFrame(() => setVisible(true));
        const timer = setTimeout(() => {
            setExiting(true);
            setTimeout(() => onRemove(toast.id), 300);
        }, toast.duration || 4000);
        return () => clearTimeout(timer);
    }, [toast.id, toast.duration, onRemove]);

    return (
        <div
            className={`pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl border shadow-lg transition-all duration-300 ${BG[toast.type]} ${
                visible && !exiting ? 'translate-x-0 opacity-100' : 'translate-x-8 opacity-0'
            }`}
        >
            <div className="shrink-0 mt-0.5">{ICONS[toast.type]}</div>
            <p className="text-sm text-brand-text-primary flex-1 leading-relaxed">{toast.message}</p>
            <button
                onClick={() => { setExiting(true); setTimeout(() => onRemove(toast.id), 300); }}
                className="shrink-0 p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
            >
                <X className="w-3.5 h-3.5 text-brand-text-muted" />
            </button>
        </div>
    );
}
