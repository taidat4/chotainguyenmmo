'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { formatCurrency, formatDateTime, getStatusLabel } from '@/lib/utils';
import { Search, Download, Eye, Package, Truck, X, CheckCircle2, Loader2 } from 'lucide-react';

interface OrderItem {
    id: string; orderCode: string; productName: string; buyerName: string;
    quantity: number; totalAmount: number; status: string; createdAt: string;
}

export default function SellerOrdersPage() {
    const { user } = useAuth();
    const [orders, setOrders] = useState<OrderItem[]>([]);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [selectedOrder, setSelectedOrder] = useState<OrderItem | null>(null);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({ pending: 0, delivering: 0, completed: 0, total: 0 });
    const [toast, setToast] = useState('');

    const token = typeof window !== 'undefined' ? localStorage.getItem('token') || '' : '';
    const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

    useEffect(() => {
        (async () => {
            try {
                const res = await fetch('/api/v1/seller/orders', { headers: { Authorization: `Bearer ${token}` } });
                const data = await res.json();
                if (data.success) {
                    setOrders(data.data.orders);
                    setStats(data.data.stats);
                }
            } catch { }
            setLoading(false);
        })();
    }, []);

    const filtered = orders.filter(o => {
        const matchSearch = !search || o.orderCode.toLowerCase().includes(search.toLowerCase()) || o.productName.toLowerCase().includes(search.toLowerCase());
        const matchStatus = statusFilter === 'all' || o.status === statusFilter;
        return matchSearch && matchStatus;
    });

    if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-brand-primary" /></div>;

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-xl font-bold text-brand-text-primary mb-1">Đơn hàng của shop</h1>
                <p className="text-sm text-brand-text-muted">Quản lý đơn hàng, xác nhận giao hàng và theo dõi trạng thái.</p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                    { label: 'Chờ xử lý', value: stats.pending, color: 'text-brand-warning' },
                    { label: 'Đang giao', value: stats.delivering, color: 'text-brand-info' },
                    { label: 'Hoàn tất', value: stats.completed, color: 'text-brand-success' },
                    { label: 'Tổng đơn', value: stats.total, color: 'text-brand-primary' },
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
                    <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm theo mã đơn, sản phẩm..." className="input-field !py-2 !pl-10 text-sm w-full" />
                </div>
                <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="input-field !py-2 text-sm min-w-[130px]">
                    <option value="all">Tất cả</option>
                    <option value="paid">Chờ xử lý</option>
                    <option value="delivering">Đang giao</option>
                    <option value="completed">Hoàn tất</option>
                </select>
            </div>

            <div className="card !p-0 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-brand-surface-2/50">
                                <th className="text-left text-xs text-brand-text-muted font-medium py-3 px-4">Mã đơn</th>
                                <th className="text-left text-xs text-brand-text-muted font-medium py-3 px-4">Sản phẩm</th>
                                <th className="text-left text-xs text-brand-text-muted font-medium py-3 px-4">Khách hàng</th>
                                <th className="text-center text-xs text-brand-text-muted font-medium py-3 px-4">SL</th>
                                <th className="text-right text-xs text-brand-text-muted font-medium py-3 px-4">Tổng tiền</th>
                                <th className="text-center text-xs text-brand-text-muted font-medium py-3 px-4">Trạng thái</th>
                                <th className="text-right text-xs text-brand-text-muted font-medium py-3 px-4">Thời gian</th>
                                <th className="text-center text-xs text-brand-text-muted font-medium py-3 px-4">Thao tác</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.length === 0 ? (
                                <tr><td colSpan={8} className="text-center py-12 text-brand-text-muted text-sm">Chưa có đơn hàng nào.</td></tr>
                            ) : filtered.map(order => (
                                <tr key={order.id} className="border-t border-brand-border/50 hover:bg-brand-surface-2/30 transition-colors">
                                    <td className="py-3 px-4 text-brand-primary font-medium text-xs">{order.orderCode}</td>
                                    <td className="py-3 px-4">
                                        <div className="flex items-center gap-2">
                                            <Package className="w-4 h-4 text-brand-primary shrink-0" />
                                            <span className="text-brand-text-primary text-xs truncate max-w-[180px]">{order.productName}</span>
                                        </div>
                                    </td>
                                    <td className="py-3 px-4 text-brand-text-secondary text-xs">{order.buyerName}</td>
                                    <td className="py-3 px-4 text-center text-brand-text-primary">{order.quantity}</td>
                                    <td className="py-3 px-4 text-right font-semibold text-brand-text-primary">{formatCurrency(order.totalAmount)}</td>
                                    <td className="py-3 px-4 text-center">
                                        <span className={`badge text-[10px] ${order.status === 'completed' ? 'badge-success' : order.status === 'delivered' ? 'badge-info' : order.status === 'paid' ? 'badge-primary' : 'badge-warning'}`}>
                                            {getStatusLabel(order.status)}
                                        </span>
                                    </td>
                                    <td className="py-3 px-4 text-right text-brand-text-muted text-xs">{formatDateTime(order.createdAt)}</td>
                                    <td className="py-3 px-4">
                                        <button onClick={() => setSelectedOrder(order)} className="p-1.5 rounded-lg text-brand-text-muted hover:text-brand-primary hover:bg-brand-surface-2 mx-auto block">
                                            <Eye className="w-3.5 h-3.5" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {selectedOrder && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setSelectedOrder(null)} />
                    <div className="relative bg-brand-surface border border-brand-border rounded-2xl shadow-card-hover max-w-md w-full p-6 animate-slide-up">
                        <button onClick={() => setSelectedOrder(null)} className="absolute top-4 right-4 p-1 rounded-lg hover:bg-brand-surface-2"><X className="w-5 h-5 text-brand-text-muted" /></button>
                        <h2 className="text-lg font-bold text-brand-text-primary mb-4">📦 Chi tiết đơn hàng</h2>
                        <div className="space-y-3">
                            <div className="flex justify-between text-sm"><span className="text-brand-text-muted">Mã đơn</span><span className="font-mono text-brand-primary font-semibold">{selectedOrder.orderCode}</span></div>
                            <div className="flex justify-between text-sm"><span className="text-brand-text-muted">Sản phẩm</span><span>{selectedOrder.productName}</span></div>
                            <div className="flex justify-between text-sm"><span className="text-brand-text-muted">Khách hàng</span><span>{selectedOrder.buyerName}</span></div>
                            <div className="flex justify-between text-sm"><span className="text-brand-text-muted">Số lượng</span><span>{selectedOrder.quantity}</span></div>
                            <div className="flex justify-between text-sm"><span className="text-brand-text-muted">Tổng tiền</span><span className="text-brand-primary font-bold">{formatCurrency(selectedOrder.totalAmount)}</span></div>
                            <div className="flex justify-between text-sm"><span className="text-brand-text-muted">Trạng thái</span><span className="badge badge-info text-[10px]">{getStatusLabel(selectedOrder.status)}</span></div>
                            <div className="flex justify-between text-sm"><span className="text-brand-text-muted">Ngày đặt</span><span className="text-xs">{formatDateTime(selectedOrder.createdAt)}</span></div>
                        </div>
                        <button onClick={() => setSelectedOrder(null)} className="btn-secondary w-full !py-3 mt-5">Đóng</button>
                    </div>
                </div>
            )}

            {toast && (
                <div className="fixed bottom-6 right-6 z-50 bg-brand-surface border border-brand-border rounded-xl shadow-card-hover px-5 py-3 flex items-center gap-2 animate-slide-up">
                    <CheckCircle2 className="w-5 h-5 text-brand-success" /><span className="text-sm text-brand-text-primary font-medium">{toast}</span>
                </div>
            )}
        </div>
    );
}
