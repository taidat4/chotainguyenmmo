'use client';

import Link from 'next/link';
import { Home, ArrowLeft, Search } from 'lucide-react';

export default function NotFound() {
    return (
        <div className="min-h-screen bg-brand-bg flex items-center justify-center p-6">
            <div className="text-center max-w-md">
                <div className="text-8xl font-bold gradient-text mb-4">404</div>
                <h1 className="text-2xl font-bold text-brand-text-primary mb-2">Trang không tồn tại</h1>
                <p className="text-brand-text-secondary mb-8">
                    Xin lỗi, trang bạn đang tìm kiếm không tồn tại hoặc đã bị xoá.
                </p>
                <div className="flex gap-3 justify-center">
                    <Link href="/" className="btn-primary flex items-center gap-2">
                        <Home className="w-4 h-4" /> Về trang chủ
                    </Link>
                    <button onClick={() => history.back()} className="btn-secondary flex items-center gap-2">
                        <ArrowLeft className="w-4 h-4" /> Quay lại
                    </button>
                </div>
                <div className="mt-8 p-4 bg-brand-surface-2 rounded-xl border border-brand-border">
                    <p className="text-sm text-brand-text-muted mb-2">Thử tìm kiếm sản phẩm:</p>
                    <div className="flex items-center bg-brand-surface border border-brand-border rounded-xl px-3 py-2">
                        <Search className="w-4 h-4 text-brand-text-muted" />
                        <input placeholder="Nhập từ khóa..." className="flex-1 bg-transparent outline-none px-2 text-sm text-brand-text-primary" />
                    </div>
                </div>
            </div>
        </div>
    );
}
