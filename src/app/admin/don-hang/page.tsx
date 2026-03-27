'use client';

import { useState, useEffect } from 'react';
import { formatCurrency, formatDateTime, getStatusLabel } from '@/lib/utils';
import { Search, Eye, Package, X, User, CreditCard, Clock, Store, Copy, CheckCircle2, Loader2 } from 'lucide-react';

interface Order {
    id: string;
    orderCode: string;
    productName: string;
    shopName: string;
    buyerName: string;
    quantity: number;
    totalAmount: number;
    feeAmount: number;
    status: string;
    createdAt: string;
}

export default function AdminOrdersPage() {
    const [orders, setOrders] = useState<Order[]>([]);
    const [selected, setSelected] = useState<Order | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState('');

    const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 2000); };

    useEffect(() => {
        fetchOrders();
    }, []);

    const fetchOrders = async () => {
        try {
            const token = localStorage.getItem('token') || '';
            const res = await fetch('/api/v1/orders', {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json();
            if (data.success) {
                setOrders(data.data || []);
            }
        } catch (e) {
            console.error('[Admin Orders] Fetch error:', e);
        }
        setLoading(false);
    };

    const filtered = orders.filter(o => {
        const matchSearch = !searchTerm || o.orderCode?.toLowerCase().includes(searchTerm.toLowerCase()) || o.productName?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchStatus = statusFilter === 'all' || o.status?.toLowerCase() === statusFilter;
        return matchSearch && matchStatus;
    });

    if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-brand-primary" /></div>;

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-xl font-bold text-brand-text-primary mb-1">Quản lý đơn hàng</h1>
                <p className="text-sm text-brand-text-muted">Theo dõi tất cả đơn hàng trên hệ thống, xử lý tranh chấp và hoàn tiền.</p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                    { label: 'Tổng đơn hàng', value: orders.length.toLocaleString(), color: 'text-brand-primary' },
                    { label: 'Hoàn tất', value: orders.filter(o => o.status?.toLowerCase() === 'completed').length, color: 'text-brand-success' },
                    { label: 'Đang xử lý', value: orders.filter(o => o.status?.toLowerCase() === 'processing' || o.status?.toLowerCase() === 'delivering').length, color: 'text-brand-warning' },
                    { label: 'Đã thanh toán', value: orders.filter(o => o.status?.toLowerCase() === 'paid').length, color: 'text-brand-info' },
                ].map((s, i) => (
                    <div key={i} className="card !p-4">
                        <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
                        <div className="text-xs text-brand-text-muted mt-1">{s.label}</div>
                    </div>
                ))}
            </div>
            <div className="card !p-4 flex flex-col sm:flex-row gap-3">
                <div className="flex-1 relative">
                    <Search className="w-4 h-4 text-brand-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
                    <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Tìm theo mã đơn, sản phẩm..." className="input-field !py-2 !pl-10 text-sm w-full" />
                </div>
                <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="input-field !py-2 text-sm min-w-[130px]">
                    <option value="all">Tất cả</option>
                    <option value="completed">Hoàn tất</option>
                    <option value="processing">Đang xử lý</option>
                    <option value="paid">Đã thanh toán</option>
                    <option value="dispute">Tranh chấp</option>
                </select>
            </div>
            <div className="card !p-0 overflow-hidden">
                <table className="w-full text-sm">
                    <thead><tr className="bg-brand-surface-2/50">
                        <th className="text-left text-xs text-brand-text-muted font-medium py-3 px-4">Mã đơn</th>
                        <th className="text-left text-xs text-brand-text-muted font-medium py-3 px-4">Sản phẩm</th>
                        <th className="text-left text-xs text-brand-text-muted font-medium py-3 px-4">Shop</th>
                        <th className="text-right text-xs text-brand-text-muted font-medium py-3 px-4">Tổng tiền</th>
                        <th className="text-center text-xs text-brand-text-muted font-medium py-3 px-4">Trạng thái</th>
                        <th className="text-right text-xs text-brand-text-muted font-medium py-3 px-4">Thời gian</th>
                        <th className="text-center text-xs text-brand-text-muted font-medium py-3 px-4">Thao tác</th>
                    </tr></thead>
                    <tbody>
                        {filtered.length === 0 ? (
                            <tr><td colSpan={7} className="text-center py-12 text-brand-text-muted text-sm">Chưa có đơn hàng nào</td></tr>
                        ) : filtered.map(o => (
                            <tr key={o.id} className="border-t border-brand-border/50 hover:bg-brand-surface-2/30 cursor-pointer" onClick={() => setSelected(o)}>
                                <td className="py-3 px-4 text-brand-primary font-medium text-xs">{o.orderCode}</td>
                                <td className="py-3 px-4"><div className="flex items-center gap-2"><Package className="w-4 h-4 text-brand-primary shrink-0" /><span className="text-xs truncate max-w-[150px]">{o.productName}</span></div></td>
                                <td className="py-3 px-4 text-xs text-brand-text-secondary">{o.shopName}</td>
                                <td className="py-3 px-4 text-right font-semibold">{formatCurrency(o.totalAmount)}</td>
                                <td className="py-3 px-4 text-center"><span className={`badge text-[10px] ${o.status?.toLowerCase() === 'completed' ? 'badge-success' : o.status?.toLowerCase() === 'processing' || o.status?.toLowerCase() === 'delivering' ? 'badge-warning' : o.status?.toLowerCase() === 'paid' ? 'badge-info' : 'badge-neutral'}`}>{getStatusLabel(o.status)}</span></td>
                                <td className="py-3 px-4 text-right text-xs text-brand-text-muted">{formatDateTime(o.createdAt)}</td>
                                <td className="py-3 px-4 text-center"><button className="p-1.5 rounded-lg text-brand-text-muted hover:text-brand-primary hover:bg-brand-surface-2"><Eye className="w-3.5 h-3.5" /></button></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Order Detail Modal */}
            {selected && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-brand-surface border border-brand-border rounded-2xl shadow-card-hover max-w-lg w-full p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold text-brand-text-primary">Chi tiết đơn hàng</h3>
                            <button onClick={() => setSelected(null)} className="p-1 rounded-lg hover:bg-brand-surface-2"><X className="w-5 h-5" /></button>
                        </div>
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <span className="text-brand-primary font-mono font-semibold text-sm">{selected.orderCode}</span>
                                    <button onClick={() => { navigator.clipboard.writeText(selected.orderCode); showToast('📋 Đã copy mã đơn'); }} className="p-1 rounded hover:bg-brand-surface-2"><Copy className="w-3.5 h-3.5 text-brand-text-muted" /></button>
                                </div>
                                <span className={`badge text-[10px] ${selected.status?.toLowerCase() === 'completed' ? 'badge-success' : selected.status?.toLowerCase() === 'processing' ? 'badge-warning' : 'badge-info'}`}>{getStatusLabel(selected.status)}</span>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="bg-brand-surface-2 rounded-xl p-3">
                                    <div className="text-[10px] uppercase text-brand-text-muted tracking-wider mb-1">Sản phẩm</div>
                                    <div className="text-sm font-medium text-brand-text-primary flex items-center gap-1.5"><Package className="w-3.5 h-3.5 text-brand-primary" /> {selected.productName}</div>
                                </div>
                                <div className="bg-brand-surface-2 rounded-xl p-3">
                                    <div className="text-[10px] uppercase text-brand-text-muted tracking-wider mb-1">Shop</div>
                                    <div className="text-sm font-medium text-brand-text-primary flex items-center gap-1.5"><Store className="w-3.5 h-3.5 text-brand-info" /> {selected.shopName}</div>
                                </div>
                                <div className="bg-brand-surface-2 rounded-xl p-3">
                                    <div className="text-[10px] uppercase text-brand-text-muted tracking-wider mb-1">Người mua</div>
                                    <div className="text-sm font-medium text-brand-text-primary flex items-center gap-1.5"><User className="w-3.5 h-3.5 text-brand-success" /> {selected.buyerName || 'Khách hàng'}</div>
                                </div>
                                <div className="bg-brand-surface-2 rounded-xl p-3">
                                    <div className="text-[10px] uppercase text-brand-text-muted tracking-wider mb-1">Tổng tiền</div>
                                    <div className="text-sm font-bold text-brand-success flex items-center gap-1.5"><CreditCard className="w-3.5 h-3.5" /> {formatCurrency(selected.totalAmount)}</div>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-brand-text-muted">
                                <Clock className="w-3.5 h-3.5" /> Ngày tạo: {formatDateTime(selected.createdAt)}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {toast && <div className="fixed bottom-6 right-6 z-50 bg-brand-surface border border-brand-border rounded-xl shadow-card-hover px-5 py-3 animate-slide-up"><span className="text-sm text-brand-text-primary font-medium">{toast}</span></div>}
        </div>
    );
}
