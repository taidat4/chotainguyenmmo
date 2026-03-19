'use client';

import { useState, useEffect } from 'react';
import { CheckCircle, XCircle, Eye, ToggleLeft, ToggleRight, AlertTriangle, ArrowUpCircle, Clock, Ban, Loader2 } from 'lucide-react';
import { useUI } from '@/components/shared/UIProvider';

interface Withdrawal {
    id: string;
    user: string;
    userId: string;
    type: string;
    method: string;
    amount: number;
    feeAmount: number;
    netAmount: number;
    bankName: string;
    accountNumber: string;
    accountName: string;
    status: string;
    note: string;
    createdAt: string;
    completedAt: string | null;
}

export default function AdminWithdrawalsPage() {
    const { showToast, showConfirm } = useUI();
    const [autoApprove, setAutoApprove] = useState(false);
    const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all');
    const [rejectModal, setRejectModal] = useState<string | null>(null);
    const [rejectReason, setRejectReason] = useState('');
    const [processing, setProcessing] = useState<string | null>(null);
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') || '' : '';

    const fmt = (n: number) => n.toLocaleString('vi-VN') + 'đ';
    const fmtDate = (d: string) => {
        try {
            const date = new Date(d);
            return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
        } catch { return d; }
    };

    const fetchWithdrawals = async () => {
        try {
            const res = await fetch('/api/v1/admin/withdrawals', {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json();
            if (data.success) setWithdrawals(data.data);
        } catch {}
        setLoading(false);
    };

    useEffect(() => { fetchWithdrawals(); }, []);

    // Poll every 10 seconds
    useEffect(() => {
        const interval = setInterval(fetchWithdrawals, 10000);
        return () => clearInterval(interval);
    }, []);

    const handleApprove = async (id: string) => {
        showConfirm({
            title: 'Duyệt rút tiền',
            message: 'Xác nhận duyệt yêu cầu rút tiền này?',
            confirmText: 'Duyệt',
            variant: 'primary',
            onConfirm: async () => {
                setProcessing(id);
                try {
                    const res = await fetch('/api/v1/admin/withdrawals', {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                        body: JSON.stringify({ id, action: 'approve' }),
                    });
                    const data = await res.json();
                    if (data.success) {
                        setWithdrawals(prev => prev.map(w => w.id === id ? { ...w, status: 'completed' } : w));
                        showToast('Đã duyệt yêu cầu rút tiền', 'success');
                    } else {
                        showToast(data.message, 'error');
                    }
                } catch { showToast('Lỗi kết nối', 'error'); }
                setProcessing(null);
            }
        });
    };

    const handleReject = async (id: string) => {
        setProcessing(id);
        try {
            const res = await fetch('/api/v1/admin/withdrawals', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ id, action: 'reject', reason: rejectReason }),
            });
            const data = await res.json();
            if (data.success) {
                setWithdrawals(prev => prev.map(w => w.id === id ? { ...w, status: 'rejected', note: rejectReason } : w));
                showToast('Đã từ chối yêu cầu rút tiền', 'warning');
            } else {
                showToast(data.message, 'error');
            }
        } catch { showToast('Lỗi kết nối', 'error'); }
        setProcessing(null);
        setRejectModal(null);
        setRejectReason('');
    };

    const filtered = filter === 'all' ? withdrawals : withdrawals.filter(w => w.status === filter);
    const pendingCount = withdrawals.filter(w => w.status === 'pending').length;
    const completedCount = withdrawals.filter(w => w.status === 'completed').length;
    const totalCompleted = withdrawals.reduce((s, w) => s + (w.status === 'completed' ? w.netAmount : 0), 0);
    const rejectedCount = withdrawals.filter(w => w.status === 'rejected').length;

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-xl font-bold text-brand-text-primary mb-1">Quản lý rút tiền</h1>
                    <p className="text-sm text-brand-text-muted">Duyệt và xử lý yêu cầu rút tiền từ sellers & users. Mốc tối thiểu: <span className="font-semibold text-brand-warning">50.000đ</span></p>
                </div>
                <div className="flex items-center gap-3 card !p-3 !py-2.5 shrink-0">
                    <span className="text-sm text-brand-text-secondary">Tự động duyệt:</span>
                    <button
                        onClick={() => setAutoApprove(!autoApprove)}
                        className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium transition-all ${autoApprove ? 'bg-brand-success/15 text-brand-success' : 'bg-brand-surface-2 text-brand-text-muted'}`}
                    >
                        {autoApprove ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                        {autoApprove ? 'BẬT' : 'TẮT'}
                    </button>
                </div>
            </div>

            {autoApprove && (
                <div className="bg-brand-warning/10 border border-brand-warning/30 rounded-xl px-4 py-3 flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-brand-warning shrink-0 mt-0.5" />
                    <div>
                        <div className="text-sm font-medium text-brand-warning">Chế độ tự động duyệt đang BẬT</div>
                        <div className="text-xs text-brand-text-muted mt-0.5">Tất cả đơn rút tiền hợp lệ sẽ được tự động duyệt mà không cần thao tác thủ công.</div>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                    { label: 'Chờ duyệt', value: pendingCount, icon: Clock, color: 'text-brand-warning' },
                    { label: 'Đã duyệt', value: completedCount, icon: CheckCircle, color: 'text-brand-success' },
                    { label: 'Tổng rút (đã duyệt)', value: fmt(totalCompleted), icon: ArrowUpCircle, color: 'text-brand-primary' },
                    { label: 'Từ chối', value: rejectedCount, icon: Ban, color: 'text-brand-danger' },
                ].map((s, i) => (
                    <div key={i} className="card !p-4">
                        <div className="flex items-center gap-2 mb-2">
                            <s.icon className={`w-4 h-4 ${s.color}`} />
                            <span className="text-xs text-brand-text-muted">{s.label}</span>
                        </div>
                        <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
                    </div>
                ))}
            </div>

            <div className="flex gap-2">
                {[
                    { key: 'all', label: 'Tất cả' },
                    { key: 'pending', label: `Chờ duyệt (${pendingCount})` },
                    { key: 'completed', label: 'Đã duyệt' },
                    { key: 'rejected', label: 'Từ chối' },
                ].map(f => (
                    <button key={f.key} onClick={() => setFilter(f.key)}
                        className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${filter === f.key ? 'bg-brand-primary text-white' : 'bg-brand-surface border border-brand-border text-brand-text-secondary hover:border-brand-primary'}`}>
                        {f.label}
                    </button>
                ))}
            </div>

            <div className="card !p-0 overflow-hidden">
                {loading ? (
                    <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-brand-primary" /></div>
                ) : filtered.length === 0 ? (
                    <div className="text-center py-16 text-sm text-brand-text-muted">
                        {filter === 'pending' ? 'Không có yêu cầu chờ duyệt' : 'Chưa có yêu cầu rút tiền nào'}
                    </div>
                ) : (
                    <table className="w-full text-sm">
                        <thead><tr className="bg-brand-surface-2/50">
                            <th className="text-left text-xs text-brand-text-muted font-medium py-3 px-4">Mã</th>
                            <th className="text-left text-xs text-brand-text-muted font-medium py-3 px-4">Người yêu cầu</th>
                            <th className="text-center text-xs text-brand-text-muted font-medium py-3 px-4">Loại</th>
                            <th className="text-left text-xs text-brand-text-muted font-medium py-3 px-4">Ngân hàng</th>
                            <th className="text-right text-xs text-brand-text-muted font-medium py-3 px-4">Số tiền</th>
                            <th className="text-right text-xs text-brand-text-muted font-medium py-3 px-4">Nhận thực</th>
                            <th className="text-center text-xs text-brand-text-muted font-medium py-3 px-4">Trạng thái</th>
                            <th className="text-right text-xs text-brand-text-muted font-medium py-3 px-4">Thời gian</th>
                            <th className="text-center text-xs text-brand-text-muted font-medium py-3 px-4">Thao tác</th>
                        </tr></thead>
                        <tbody>
                            {filtered.map(w => (
                                <tr key={w.id} className="border-t border-brand-border/50 hover:bg-brand-surface-2/30">
                                    <td className="py-3 px-4 text-brand-primary font-mono font-medium text-xs">{w.id.slice(-8)}</td>
                                    <td className="py-3 px-4">
                                        <div className="text-sm text-brand-text-primary font-medium">{w.user}</div>
                                        <div className="text-[10px] text-brand-text-muted">{w.accountName} • {w.accountNumber}</div>
                                    </td>
                                    <td className="py-3 px-4 text-center"><span className={`badge text-[10px] ${w.type === 'seller' ? 'badge-primary' : 'badge-neutral'}`}>{w.type === 'seller' ? 'Seller' : 'Buyer'}</span></td>
                                    <td className="py-3 px-4 text-xs text-brand-text-secondary">{w.bankName}<br /><span className="text-[10px] text-brand-text-muted">{w.accountNumber}</span></td>
                                    <td className="py-3 px-4 text-right">
                                        <div className="font-semibold text-brand-danger">{fmt(w.amount)}</div>
                                        <div className="text-[10px] text-brand-text-muted">Phí: {fmt(w.feeAmount)}</div>
                                    </td>
                                    <td className="py-3 px-4 text-right font-semibold text-brand-success">{fmt(w.netAmount)}</td>
                                    <td className="py-3 px-4 text-center">
                                        <span className={`badge text-[10px] ${w.status === 'completed' ? 'badge-success' : w.status === 'pending' ? 'badge-warning' : 'badge-danger'}`}>
                                            {w.status === 'completed' ? 'Đã duyệt' : w.status === 'pending' ? 'Chờ duyệt' : 'Từ chối'}
                                        </span>
                                        {w.note && <div className="text-[10px] text-brand-text-muted mt-0.5">{w.note}</div>}
                                    </td>
                                    <td className="py-3 px-4 text-right text-xs text-brand-text-muted">{fmtDate(w.createdAt)}</td>
                                    <td className="py-3 px-4 text-center">
                                        {w.status === 'pending' ? (
                                            <div className="flex justify-center gap-1">
                                                <button onClick={() => handleApprove(w.id)} disabled={processing === w.id}
                                                    className="p-1.5 rounded-lg text-brand-text-muted hover:text-brand-success hover:bg-brand-success/10 transition-colors disabled:opacity-50" title="Duyệt">
                                                    {processing === w.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                                                </button>
                                                <button onClick={() => setRejectModal(w.id)} disabled={processing === w.id}
                                                    className="p-1.5 rounded-lg text-brand-text-muted hover:text-brand-danger hover:bg-brand-danger/10 transition-colors disabled:opacity-50" title="Từ chối">
                                                    <XCircle className="w-4 h-4" />
                                                </button>
                                            </div>
                                        ) : (
                                            <span className="text-[10px] text-brand-text-muted">Đã xử lý</span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Reject Modal */}
            {rejectModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                    <div className="bg-brand-surface rounded-2xl p-6 w-[400px] shadow-card-hover border border-brand-border animate-slide-up">
                        <h3 className="text-lg font-semibold text-brand-text-primary mb-4">Từ chối yêu cầu rút tiền</h3>
                        <p className="text-sm text-brand-text-muted mb-3">Tiền sẽ được <strong className="text-brand-success">hoàn lại ví</strong> của người rút. Vui lòng nhập lý do:</p>
                        <textarea
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                            placeholder="Lý do từ chối..."
                            className="input-field w-full h-24 resize-none text-sm"
                        />
                        <div className="flex gap-3 mt-4">
                            <button onClick={() => { setRejectModal(null); setRejectReason(''); }} className="btn-secondary flex-1 text-sm">Hủy</button>
                            <button onClick={() => handleReject(rejectModal)} disabled={processing === rejectModal}
                                className="bg-brand-danger text-white flex-1 py-2 rounded-xl text-sm font-medium hover:brightness-110 transition-all disabled:opacity-60 flex items-center justify-center gap-2">
                                {processing === rejectModal && <Loader2 className="w-4 h-4 animate-spin" />}
                                Xác nhận từ chối
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
