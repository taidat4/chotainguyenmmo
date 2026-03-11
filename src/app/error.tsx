'use client';

import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import Link from 'next/link';

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    return (
        <div className="min-h-screen bg-brand-bg flex items-center justify-center p-6">
            <div className="text-center max-w-md">
                <div className="w-16 h-16 rounded-2xl bg-brand-danger/10 flex items-center justify-center mx-auto mb-5">
                    <AlertTriangle className="w-8 h-8 text-brand-danger" />
                </div>
                <h1 className="text-2xl font-bold text-brand-text-primary mb-2">Có lỗi xảy ra</h1>
                <p className="text-brand-text-secondary mb-6">
                    Đã xảy ra lỗi không mong muốn. Vui lòng thử lại hoặc quay về trang chủ.
                </p>
                {error.message && (
                    <div className="bg-brand-surface-2 border border-brand-border rounded-xl p-3 mb-6 text-left">
                        <p className="text-xs text-brand-text-muted font-medium mb-1">Chi tiết lỗi:</p>
                        <p className="text-xs text-brand-danger font-mono">{error.message}</p>
                    </div>
                )}
                <div className="flex gap-3 justify-center">
                    <button onClick={reset} className="btn-primary flex items-center gap-2">
                        <RefreshCw className="w-4 h-4" /> Thử lại
                    </button>
                    <Link href="/" className="btn-secondary flex items-center gap-2">
                        <Home className="w-4 h-4" /> Trang chủ
                    </Link>
                </div>
            </div>
        </div>
    );
}
