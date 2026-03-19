'use client';

import React, { useState, useEffect } from 'react';
import {
    Megaphone, Loader2, Package, Calendar, DollarSign, Eye,
    Check, X as XIcon, Pause, AlertCircle
} from 'lucide-react';

function formatCurrency(n: number) { return n.toLocaleString('vi-VN') + 'đ'; }

const statusLabels: Record<string, { label: string; cls: string }> = {
    DRAFT: { label: 'Nháp', cls: 'text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600' },
    PENDING_REVIEW: { label: 'Chờ duyệt', cls: 'text-xs px-2 py-0.5 rounded-full bg-brand-warning/10 text-brand-warning border border-brand-warning/30' },
    ACTIVE: { label: 'Đang chạy', cls: 'badge-success' },
    PAUSED: { label: 'Tạm dừng', cls: 'badge-secondary' },
    COMPLETED: { label: 'Hoàn thành', cls: 'badge-primary' },
    REJECTED: { label: 'Từ chối', cls: 'text-xs px-2 py-0.5 rounded-full bg-brand-danger/10 text-brand-danger' },
};

export default function AdminAdsPage() {
    const [campaigns, setCampaigns] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState('');
    const [rejectModal, setRejectModal] = useState<{ id: string; reason: string } | null>(null);

    const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

    const fetchData = async () => {
        const token = localStorage.getItem('admin_token') || localStorage.getItem('token') || '';
        try {
            const res = await fetch('/api/v1/admin/ads', { headers: { Authorization: `Bearer ${token}` } });
            const data = await res.json();
            if (data.success) setCampaigns(data.data);
        } catch { }
        setLoading(false);
    };

    useEffect(() => { fetchData(); }, []);

    const handleAction = async (campaignId: string, action: string, reason?: string) => {
        const token = localStorage.getItem('admin_token') || localStorage.getItem('token') || '';
        try {
            const res = await fetch('/api/v1/admin/ads', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ campaignId, action, reason }),
            });
            const data = await res.json();
            showToast(data.success ? '✅ ' + data.message : '❌ ' + data.message);
            if (data.success) { fetchData(); setRejectModal(null); }
        } catch { showToast('❌ Lỗi kết nối'); }
    };

    const pendingCount = campaigns.filter(c => c.status === 'PENDING_REVIEW').length;
    const activeCount = campaigns.filter(c => c.status === 'ACTIVE').length;
    const totalRevenue = campaigns.reduce((s, c) => s + c.spentAmount, 0);

    if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-brand-primary" /></div>;

    return (
        <div className="space-y-6">
            {toast && <div className="fixed top-4 right-4 z-50 bg-brand-surface border border-brand-border rounded-xl px-4 py-3 text-sm shadow-card-hover">{toast}</div>}

            <div>
                <h1 className="text-xl font-bold text-brand-text-primary flex items-center gap-2">
                    <Megaphone className="w-6 h-6 text-brand-primary" /> Quản lý quảng cáo
                </h1>
                <p className="text-sm text-brand-text-muted mt-1">Duyệt, từ chối và quản lý chiến dịch quảng cáo của seller</p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="card flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-brand-warning/10 flex items-center justify-center"><AlertCircle className="w-5 h-5 text-brand-warning" /></div>
                    <div><div className="text-xs text-brand-text-muted">Chờ duyệt</div><div className="text-lg font-bold text-brand-warning">{pendingCount}</div></div>
                </div>
                <div className="card flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-brand-success/10 flex items-center justify-center"><Eye className="w-5 h-5 text-brand-success" /></div>
                    <div><div className="text-xs text-brand-text-muted">Đang chạy</div><div className="text-lg font-bold text-brand-success">{activeCount}</div></div>
                </div>
                <div className="card flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-brand-primary/10 flex items-center justify-center"><DollarSign className="w-5 h-5 text-brand-primary" /></div>
                    <div><div className="text-xs text-brand-text-muted">Doanh thu quảng cáo</div><div className="text-lg font-bold text-brand-primary">{formatCurrency(totalRevenue)}</div></div>
                </div>
            </div>

            {/* Campaigns */}
            {campaigns.length === 0 ? (
                <div className="card text-center py-12">
                    <Megaphone className="w-10 h-10 text-brand-text-muted/30 mx-auto mb-3" />
                    <p className="text-sm text-brand-text-muted">Chưa có chiến dịch quảng cáo nào</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {campaigns.map(c => (
                        <div key={c.id} className={`card ${c.status === 'PENDING_REVIEW' ? 'border-brand-warning/30 ring-1 ring-brand-warning/10' : ''}`}>
                            <div className="flex items-start gap-4">
                                <div className="w-12 h-12 rounded-lg bg-brand-surface-2 flex items-center justify-center overflow-hidden shrink-0">
                                    {c.product?.images?.[0]?.url ? (
                                        <img src={c.product.images[0].url} className="w-full h-full object-cover" />
                                    ) : (
                                        <Package className="w-6 h-6 text-brand-text-muted/30" />
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <h3 className="text-sm font-semibold text-brand-text-primary truncate">{c.title}</h3>
                                        <span className={statusLabels[c.status]?.cls}>{statusLabels[c.status]?.label}</span>
                                    </div>
                                    <p className="text-xs text-brand-text-muted mb-1">Sản phẩm: {c.product?.name} | Seller: {c.sellerId}</p>
                                    <div className="flex items-center gap-3 text-xs text-brand-text-muted flex-wrap">
                                        <span>Bid: <b className="text-brand-primary">{formatCurrency(c.bidAmount)}</b></span>
                                        <span>Ngân sách: <b>{formatCurrency(c.totalBudget)}</b></span>
                                        <span>Đã chi: <b className="text-brand-warning">{formatCurrency(c.spentAmount)}</b></span>
                                        <span className="flex items-center gap-1"><Eye className="w-3 h-3" />{c.impressions}</span>
                                        <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{new Date(c.startDate).toLocaleDateString('vi-VN')} — {new Date(c.endDate).toLocaleDateString('vi-VN')}</span>
                                    </div>
                                    {c.rejectedReason && <p className="text-xs text-brand-danger mt-1">Lý do: {c.rejectedReason}</p>}
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                    {c.status === 'PENDING_REVIEW' && (
                                        <>
                                            <button onClick={() => handleAction(c.id, 'approve')} className="p-2 rounded-lg hover:bg-brand-success/10 text-brand-success" title="Duyệt">
                                                <Check className="w-4 h-4" />
                                            </button>
                                            <button onClick={() => setRejectModal({ id: c.id, reason: '' })} className="p-2 rounded-lg hover:bg-brand-danger/10 text-brand-danger" title="Từ chối">
                                                <XIcon className="w-4 h-4" />
                                            </button>
                                        </>
                                    )}
                                    {c.status === 'ACTIVE' && (
                                        <button onClick={() => handleAction(c.id, 'pause')} className="p-2 rounded-lg hover:bg-brand-warning/10 text-brand-warning" title="Tạm dừng">
                                            <Pause className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Reject Modal */}
            {rejectModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                    <div className="bg-brand-surface rounded-2xl shadow-card-hover w-full max-w-sm p-5 space-y-4">
                        <h2 className="text-base font-bold text-brand-text-primary">Từ chối chiến dịch</h2>
                        <textarea
                            value={rejectModal.reason}
                            onChange={e => setRejectModal({ ...rejectModal, reason: e.target.value })}
                            className="input-field w-full text-sm"
                            rows={3}
                            placeholder="Lý do từ chối..."
                        />
                        <div className="flex gap-3">
                            <button onClick={() => setRejectModal(null)} className="btn-secondary flex-1">Hủy</button>
                            <button onClick={() => handleAction(rejectModal.id, 'reject', rejectModal.reason)} className="btn-primary flex-1 !bg-brand-danger !border-brand-danger">Từ chối & Hoàn tiền</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
