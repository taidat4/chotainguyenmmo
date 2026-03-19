'use client';

import { useEffect, useState } from 'react';
import { CheckCircle, AlertTriangle, X, User, Package, Clock, Loader2, RefreshCw, Eye, Info } from 'lucide-react';

interface Complaint {
    id: string;
    orderCode: string;
    buyer: string;
    seller: string;
    product: string;
    reason: string;
    totalAmount: number;
    status: string; // 'open' | 'resolved' | 'refunded'
    createdAt: string;
    updatedAt: string;
}

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
    open: { label: '⏳ Đang chờ xử lý', color: 'text-brand-warning', bg: 'bg-brand-warning/10' },
    resolved: { label: '✅ Seller đã giải quyết', color: 'text-brand-success', bg: 'bg-brand-success/10' },
    refunded: { label: '💰 Đã hoàn tiền', color: 'text-brand-info', bg: 'bg-brand-info/10' },
};

export default function AdminComplaintsPage() {
    const [complaints, setComplaints] = useState<Complaint[]>([]);
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState<Complaint | null>(null);
    const [filter, setFilter] = useState<string>('all');

    const fetchComplaints = async () => {
        try {
            const token = localStorage.getItem('admin_token') || localStorage.getItem('token') || '';
            const res = await fetch('/api/v1/admin/complaints', {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json();
            if (data.success) setComplaints(data.data);
        } catch {}
        setLoading(false);
    };

    useEffect(() => { fetchComplaints(); }, []);

    const formatDate = (dateStr: string) => {
        try {
            const d = new Date(dateStr);
            const pad = (n: number) => String(n).padStart(2, '0');
            return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
        } catch { return dateStr; }
    };

    const filtered = filter === 'all' ? complaints : complaints.filter(c => c.status === filter);
    const openCount = complaints.filter(c => c.status === 'open').length;
    const resolvedCount = complaints.filter(c => c.status === 'resolved').length;
    const refundedCount = complaints.filter(c => c.status === 'refunded').length;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-bold text-brand-text-primary mb-1">Quản lý khiếu nại</h1>
                    <p className="text-sm text-brand-text-muted">Xem thông tin khiếu nại giữa người mua và người bán. Chỉ khách hàng mới có thể hủy khiếu nại.</p>
                </div>
                <button onClick={() => { setLoading(true); fetchComplaints(); }} className="btn-secondary !py-2 !px-3 text-sm flex items-center gap-1.5">
                    <RefreshCw className="w-3.5 h-3.5" /> Làm mới
                </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <button onClick={() => setFilter('all')} className={`card !p-4 text-left transition-all ${filter === 'all' ? 'border-brand-primary/50 shadow-md' : ''}`}>
                    <div className="text-xl font-bold text-brand-text-primary">{complaints.length}</div>
                    <div className="text-xs text-brand-text-muted mt-1">Tổng khiếu nại</div>
                </button>
                <button onClick={() => setFilter('open')} className={`card !p-4 text-left transition-all ${filter === 'open' ? 'border-brand-warning/50 shadow-md' : ''}`}>
                    <div className="text-xl font-bold text-brand-warning">{openCount}</div>
                    <div className="text-xs text-brand-text-muted mt-1">Đang chờ xử lý</div>
                </button>
                <button onClick={() => setFilter('resolved')} className={`card !p-4 text-left transition-all ${filter === 'resolved' ? 'border-brand-success/50 shadow-md' : ''}`}>
                    <div className="text-xl font-bold text-brand-success">{resolvedCount}</div>
                    <div className="text-xs text-brand-text-muted mt-1">Đã giải quyết</div>
                </button>
                <button onClick={() => setFilter('refunded')} className={`card !p-4 text-left transition-all ${filter === 'refunded' ? 'border-brand-info/50 shadow-md' : ''}`}>
                    <div className="text-xl font-bold text-brand-info">{refundedCount}</div>
                    <div className="text-xs text-brand-text-muted mt-1">Đã hoàn tiền</div>
                </button>
            </div>

            {/* Info banner */}
            <div className="bg-brand-info/5 border border-brand-info/20 rounded-xl px-4 py-2.5 flex items-center gap-2">
                <Info className="w-4 h-4 text-brand-info shrink-0" />
                <span className="text-xs text-brand-text-secondary">Admin chỉ theo dõi khiếu nại. Tiền được tạm giữ tự động khi có khiếu nại và hoàn trả khi khách tự hủy.</span>
            </div>

            {/* Complaint List */}
            {loading ? (
                <div className="flex items-center justify-center py-16">
                    <Loader2 className="w-6 h-6 text-brand-primary animate-spin" />
                </div>
            ) : filtered.length === 0 ? (
                <div className="card text-center py-16">
                    <CheckCircle className="w-12 h-12 text-brand-success/30 mx-auto mb-3" />
                    <p className="text-sm text-brand-text-muted">
                        {filter === 'all' ? 'Không có khiếu nại nào 🎉' : `Không có khiếu nại nào ở trạng thái "${statusConfig[filter]?.label || filter}"`}
                    </p>
                </div>
            ) : (
                <div className="space-y-3">
                    {filtered.map(c => {
                        const st = statusConfig[c.status] || statusConfig.open;
                        return (
                            <div key={c.id} className="card hover:border-brand-primary/30 transition-all cursor-pointer" onClick={() => setSelected(c)}>
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                                            <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full ${st.bg} ${st.color}`}>
                                                {st.label}
                                            </span>
                                            <span className="text-xs text-brand-primary font-mono font-medium">{c.orderCode}</span>
                                        </div>
                                        <h3 className="text-sm font-semibold text-brand-text-primary">{c.product}</h3>
                                        <p className="text-xs text-brand-text-secondary mt-1">
                                            <span className="text-brand-info">👤 {c.buyer}</span> → <span className="text-brand-warning">🏪 {c.seller}</span>
                                        </p>
                                        <p className="text-xs text-brand-text-muted mt-0.5">❗ {c.reason}</p>
                                    </div>
                                    <div className="flex items-center gap-3 shrink-0">
                                        <div className="text-right">
                                            <div className="text-sm font-bold text-brand-danger">{c.totalAmount.toLocaleString()}đ</div>
                                            <div className="text-[10px] text-brand-text-muted mt-1 flex items-center gap-1 justify-end">
                                                <Clock className="w-3 h-3" /> {formatDate(c.createdAt)}
                                            </div>
                                        </div>
                                        <button className="p-2 rounded-xl text-brand-text-muted hover:text-brand-primary hover:bg-brand-surface-2 transition-colors" title="Xem chi tiết">
                                            <Eye className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Detail Modal (read-only) */}
            {selected && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-brand-surface border border-brand-border rounded-2xl shadow-card-hover max-w-lg w-full p-6 animate-slide-up">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold text-brand-text-primary">Chi tiết khiếu nại</h3>
                            <button onClick={() => setSelected(null)} className="p-1 rounded-lg hover:bg-brand-surface-2"><X className="w-5 h-5" /></button>
                        </div>
                        <div className="space-y-3">
                            {/* Status badge */}
                            {(() => { const st = statusConfig[selected.status] || statusConfig.open; return (
                                <div className={`${st.bg} rounded-xl px-4 py-2.5 text-center`}>
                                    <span className={`text-sm font-semibold ${st.color}`}>{st.label}</span>
                                </div>
                            ); })()}

                            <div className="grid grid-cols-2 gap-3">
                                <div className="bg-brand-surface-2 rounded-xl p-3">
                                    <div className="text-[10px] uppercase text-brand-text-muted tracking-wider mb-1">Sản phẩm</div>
                                    <div className="text-sm font-medium text-brand-text-primary flex items-center gap-1.5"><Package className="w-3.5 h-3.5 text-brand-primary" /> {selected.product}</div>
                                </div>
                                <div className="bg-brand-surface-2 rounded-xl p-3">
                                    <div className="text-[10px] uppercase text-brand-text-muted tracking-wider mb-1">Mã đơn</div>
                                    <div className="text-sm font-mono font-medium text-brand-primary">{selected.orderCode}</div>
                                </div>
                                <div className="bg-brand-surface-2 rounded-xl p-3">
                                    <div className="text-[10px] uppercase text-brand-text-muted tracking-wider mb-1">Người mua</div>
                                    <div className="text-sm font-medium text-brand-text-primary flex items-center gap-1.5"><User className="w-3.5 h-3.5 text-brand-info" /> {selected.buyer}</div>
                                </div>
                                <div className="bg-brand-surface-2 rounded-xl p-3">
                                    <div className="text-[10px] uppercase text-brand-text-muted tracking-wider mb-1">Người bán</div>
                                    <div className="text-sm font-medium text-brand-text-primary">{selected.seller}</div>
                                </div>
                            </div>
                            <div className="bg-brand-surface-2 rounded-xl p-3">
                                <div className="text-[10px] uppercase text-brand-text-muted tracking-wider mb-1">Lý do khiếu nại</div>
                                <div className="text-sm text-brand-text-primary font-medium">{selected.reason}</div>
                            </div>
                            <div className="bg-brand-surface-2 rounded-xl p-3">
                                <div className="text-[10px] uppercase text-brand-text-muted tracking-wider mb-1">Giá trị đơn</div>
                                <div className="text-sm text-brand-danger font-bold">{selected.totalAmount.toLocaleString()}đ</div>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-brand-text-muted">
                                <Clock className="w-3.5 h-3.5" /> {formatDate(selected.createdAt)}
                            </div>
                            <button onClick={() => setSelected(null)} className="w-full py-2.5 rounded-xl text-sm font-medium bg-brand-surface-2 text-brand-text-primary hover:bg-brand-surface-2/80 transition-all">Đóng</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
