'use client';

import { useState, useEffect } from 'react';
import { formatCurrency } from '@/lib/utils';
import { Loader2, ArrowDownCircle, Search, CheckCircle, Zap } from 'lucide-react';

interface Deposit {
    id: string;
    transactionCode: string;
    user: string;
    userId: string;
    userRole: string;
    amount: number;
    method: string;
    status: string;
    createdAt: string;
    completedAt: string | null;
}

export default function AdminDepositsPage() {
    const [deposits, setDeposits] = useState<Deposit[]>([]);
    const [stats, setStats] = useState({ totalToday: 0, pending: 0, completed: 0, failed: 0 });
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all');
    const [search, setSearch] = useState('');

    const fetchDeposits = async () => {
        try {
            const tk = localStorage.getItem('admin_token') || localStorage.getItem('token') || '';
            const res = await fetch(`/api/v1/admin/deposits?status=${filter}`, {
                headers: { Authorization: `Bearer ${tk}` },
            });
            const data = await res.json();
            if (data.success) {
                setDeposits(data.data);
                setStats(data.stats);
            }
        } catch (e) { console.error('[AdminDeposits] Fetch error:', e); }
        setLoading(false);
    };

    useEffect(() => { fetchDeposits(); }, [filter]);

    // Poll every 15s
    useEffect(() => {
        const interval = setInterval(fetchDeposits, 15000);
        return () => clearInterval(interval);
    }, [filter]);

    const filtered = deposits.filter(d =>
        !search ||
        d.user.toLowerCase().includes(search.toLowerCase()) ||
        d.transactionCode.toLowerCase().includes(search.toLowerCase())
    );

    const statusBadge = (status: string) => {
        switch (status) {
            case 'completed': return <span className="badge-success text-[10px]">Hoàn tất</span>;
            case 'pending': return <span className="bg-brand-warning/10 text-brand-warning border border-brand-warning/30 text-[10px] px-2 py-0.5 rounded-full">Đang xử lý</span>;
            case 'failed': case 'rejected': return <span className="badge-danger text-[10px]">Thất bại</span>;
            default: return <span className="badge-secondary text-[10px]">{status}</span>;
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-xl font-bold text-brand-text-primary mb-1">Lịch sử nạp tiền</h1>
                <p className="text-sm text-brand-text-muted">Theo dõi các giao dịch nạp tiền vào ví người dùng. Tất cả lệnh nạp được xử lý tự động.</p>
            </div>

            {/* Auto-approve notice */}
            <div className="bg-brand-success/10 border border-brand-success/30 rounded-xl px-4 py-3 flex items-center gap-3">
                <Zap className="w-5 h-5 text-brand-success shrink-0" />
                <div>
                    <div className="text-sm font-medium text-brand-success">Nạp tiền tự động</div>
                    <div className="text-xs text-brand-text-muted">Tất cả giao dịch nạp tiền qua MBBank được xác nhận và cộng tiền tự động, không cần admin duyệt.</div>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                    { label: 'Tổng nạp hôm nay', value: formatCurrency(stats.totalToday), color: 'text-brand-success' },
                    { label: 'Đang xử lý', value: stats.pending.toString(), color: 'text-brand-warning' },
                    { label: 'Hoàn tất', value: stats.completed.toString(), color: 'text-brand-primary' },
                    { label: 'Thất bại', value: stats.failed.toString(), color: 'text-brand-danger' },
                ].map((s, i) => (
                    <div key={i} className="card !p-4">
                        <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
                        <div className="text-xs text-brand-text-muted mt-1">{s.label}</div>
                    </div>
                ))}
            </div>

            {/* Filters */}
            <div className="flex items-center gap-3 flex-wrap">
                <div className="flex gap-2">
                    {[
                        { key: 'all', label: 'Tất cả' },
                        { key: 'COMPLETED', label: 'Hoàn tất' },
                        { key: 'PENDING', label: 'Đang xử lý' },
                        { key: 'FAILED', label: 'Thất bại' },
                    ].map(f => (
                        <button
                            key={f.key}
                            onClick={() => { setFilter(f.key); setLoading(true); }}
                            className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-all ${filter === f.key ? 'bg-brand-primary text-white' : 'bg-brand-surface-2 text-brand-text-secondary hover:bg-brand-surface-3'}`}
                        >{f.label}</button>
                    ))}
                </div>
                <div className="relative ml-auto">
                    <Search className="w-3.5 h-3.5 text-brand-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                        type="text" value={search} onChange={e => setSearch(e.target.value)}
                        placeholder="Tìm người dùng..."
                        className="pl-8 pr-3 py-1.5 text-xs bg-brand-surface-2 border border-brand-border/50 rounded-lg outline-none focus:border-brand-primary/50 w-48"
                    />
                </div>
            </div>

            {/* Table */}
            <div className="card !p-0 overflow-hidden">
                <table className="w-full text-sm">
                    <thead><tr className="bg-brand-surface-2/50">
                        <th className="text-left text-xs text-brand-text-muted font-medium py-3 px-4">Mã</th>
                        <th className="text-left text-xs text-brand-text-muted font-medium py-3 px-4">Người dùng</th>
                        <th className="text-left text-xs text-brand-text-muted font-medium py-3 px-4">Phương thức</th>
                        <th className="text-right text-xs text-brand-text-muted font-medium py-3 px-4">Số tiền</th>
                        <th className="text-center text-xs text-brand-text-muted font-medium py-3 px-4">Trạng thái</th>
                        <th className="text-right text-xs text-brand-text-muted font-medium py-3 px-4">Thời gian</th>
                    </tr></thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={6} className="text-center py-10">
                                <Loader2 className="w-5 h-5 animate-spin text-brand-text-muted mx-auto" />
                            </td></tr>
                        ) : filtered.length === 0 ? (
                            <tr><td colSpan={6} className="text-center py-10 text-sm text-brand-text-muted">
                                <ArrowDownCircle className="w-8 h-8 text-brand-text-muted/20 mx-auto mb-2" />
                                Không có lệnh nạp tiền nào
                            </td></tr>
                        ) : (
                            filtered.map(d => (
                                <tr key={d.id} className="border-t border-brand-border/50 hover:bg-brand-surface-2/30">
                                    <td className="py-3 px-4 text-brand-primary font-medium text-xs">{d.transactionCode}</td>
                                    <td className="py-3 px-4 text-sm text-brand-text-primary">
                                        {d.user}
                                        <div className="text-[10px] text-brand-text-muted">{d.userRole}</div>
                                    </td>
                                    <td className="py-3 px-4 text-xs text-brand-text-secondary">{d.method}</td>
                                    <td className="py-3 px-4 text-right font-semibold text-brand-success">+{formatCurrency(d.amount)}</td>
                                    <td className="py-3 px-4 text-center">{statusBadge(d.status)}</td>
                                    <td className="py-3 px-4 text-right text-xs text-brand-text-muted">
                                        {new Date(d.createdAt).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' })}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
