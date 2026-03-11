'use client';

import { useState } from 'react';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import { CheckCircle, XCircle, Eye, ToggleLeft, ToggleRight, AlertTriangle, ArrowUpCircle, Clock, Ban } from 'lucide-react';

const initialWithdrawals: { id: string; user: string; type: string; method: string; amount: number; status: string; createdAt: string; note: string }[] = [];

export default function AdminWithdrawalsPage() {
    const [autoApprove, setAutoApprove] = useState(false);
    const [withdrawals, setWithdrawals] = useState(initialWithdrawals);
    const [filter, setFilter] = useState('all');
    const [rejectModal, setRejectModal] = useState<string | null>(null);
    const [rejectReason, setRejectReason] = useState('');

    const handleApprove = (id: string) => {
        setWithdrawals(prev => prev.map(w => w.id === id ? { ...w, status: 'completed' } : w));
    };

    const handleReject = (id: string) => {
        setWithdrawals(prev => prev.map(w => w.id === id ? { ...w, status: 'rejected', note: rejectReason } : w));
        setRejectModal(null);
        setRejectReason('');
    };

    const filtered = filter === 'all' ? withdrawals : withdrawals.filter(w => w.status === filter);
    const pendingCount = withdrawals.filter(w => w.status === 'pending').length;
    const completedToday = withdrawals.filter(w => w.status === 'completed').length;
    const totalMonth = withdrawals.reduce((s, w) => s + (w.status === 'completed' ? w.amount : 0), 0);
    const rejectedCount = withdrawals.filter(w => w.status === 'rejected').length;

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-xl font-bold text-brand-text-primary mb-1">Quản lý rút tiền</h1>
                    <p className="text-sm text-brand-text-muted">Duyệt và xử lý yêu cầu rút tiền từ sellers & users. Mốc tối thiểu: <span className="font-semibold text-brand-warning">500.000đ</span></p>
                </div>
                {/* Auto Approve Toggle */}
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
                        <div className="text-xs text-brand-text-muted mt-0.5">Tất cả đơn rút tiền hợp lệ (&ge; 500.000đ) sẽ được tự động duyệt mà không cần thao tác thủ công.</div>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                    { label: 'Chờ duyệt', value: pendingCount, icon: Clock, color: 'text-brand-warning' },
                    { label: 'Đã duyệt', value: completedToday, icon: CheckCircle, color: 'text-brand-success' },
                    { label: 'Tổng rút (đã duyệt)', value: formatCurrency(totalMonth), icon: ArrowUpCircle, color: 'text-brand-primary' },
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

            {/* Filter Tabs */}
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
                <table className="w-full text-sm">
                    <thead><tr className="bg-brand-surface-2/50">
                        <th className="text-left text-xs text-brand-text-muted font-medium py-3 px-4">Mã</th>
                        <th className="text-left text-xs text-brand-text-muted font-medium py-3 px-4">Người yêu cầu</th>
                        <th className="text-center text-xs text-brand-text-muted font-medium py-3 px-4">Loại</th>
                        <th className="text-left text-xs text-brand-text-muted font-medium py-3 px-4">Phương thức</th>
                        <th className="text-right text-xs text-brand-text-muted font-medium py-3 px-4">Số tiền</th>
                        <th className="text-center text-xs text-brand-text-muted font-medium py-3 px-4">Trạng thái</th>
                        <th className="text-right text-xs text-brand-text-muted font-medium py-3 px-4">Thời gian</th>
                        <th className="text-center text-xs text-brand-text-muted font-medium py-3 px-4">Thao tác</th>
                    </tr></thead>
                    <tbody>
                        {filtered.map(w => (
                            <tr key={w.id} className="border-t border-brand-border/50 hover:bg-brand-surface-2/30">
                                <td className="py-3 px-4 text-brand-primary font-medium text-xs">{w.id}</td>
                                <td className="py-3 px-4 text-sm text-brand-text-primary">{w.user}</td>
                                <td className="py-3 px-4 text-center"><span className={`badge text-[10px] ${w.type === 'seller' ? 'badge-primary' : 'badge-neutral'}`}>{w.type === 'seller' ? 'Seller' : 'Buyer'}</span></td>
                                <td className="py-3 px-4 text-xs text-brand-text-secondary">{w.method}</td>
                                <td className="py-3 px-4 text-right font-semibold text-brand-danger">-{formatCurrency(w.amount)}</td>
                                <td className="py-3 px-4 text-center">
                                    <span className={`badge text-[10px] ${w.status === 'completed' ? 'badge-success' : w.status === 'pending' ? 'badge-warning' : 'badge-danger'}`}>
                                        {w.status === 'completed' ? 'Đã xử lý' : w.status === 'pending' ? 'Chờ xử lý' : 'Từ chối'}
                                    </span>
                                    {w.note && <div className="text-[10px] text-brand-text-muted mt-0.5">{w.note}</div>}
                                </td>
                                <td className="py-3 px-4 text-right text-xs text-brand-text-muted">{formatDateTime(w.createdAt)}</td>
                                <td className="py-3 px-4 text-center">
                                    {w.status === 'pending' ? (
                                        <div className="flex justify-center gap-1">
                                            <button onClick={() => handleApprove(w.id)} className="p-1.5 rounded-lg text-brand-text-muted hover:text-brand-success hover:bg-brand-success/10 transition-colors" title="Duyệt">
                                                <CheckCircle className="w-4 h-4" />
                                            </button>
                                            <button onClick={() => setRejectModal(w.id)} className="p-1.5 rounded-lg text-brand-text-muted hover:text-brand-danger hover:bg-brand-danger/10 transition-colors" title="Từ chối">
                                                <XCircle className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ) : (
                                        <button className="p-1.5 rounded-lg text-brand-text-muted hover:text-brand-primary hover:bg-brand-surface-2">
                                            <Eye className="w-3.5 h-3.5" />
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Reject Modal */}
            {rejectModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                    <div className="bg-brand-surface rounded-2xl p-6 w-[400px] shadow-card-hover border border-brand-border">
                        <h3 className="text-lg font-semibold text-brand-text-primary mb-4">Từ chối yêu cầu rút tiền</h3>
                        <p className="text-sm text-brand-text-muted mb-3">Vui lòng nhập lý do từ chối đơn <span className="font-semibold text-brand-primary">{rejectModal}</span>:</p>
                        <textarea
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                            placeholder="Lý do từ chối..."
                            className="input-field w-full h-24 resize-none text-sm"
                        />
                        <div className="flex gap-3 mt-4">
                            <button onClick={() => setRejectModal(null)} className="btn-secondary flex-1 text-sm">Hủy</button>
                            <button onClick={() => handleReject(rejectModal)} className="bg-brand-danger text-white flex-1 py-2 rounded-xl text-sm font-medium hover:brightness-110 transition-all">Xác nhận từ chối</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
