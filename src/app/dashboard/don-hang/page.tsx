'use client';

import { useEffect, useState } from 'react';
import { formatCurrency, formatDateTime, getStatusLabel } from '@/lib/utils';
import { Search, Download, Eye, MessageSquare, Star, Package, Loader2, Copy, X, CheckCircle2 } from 'lucide-react';

interface Order {
    id: string;
    orderCode: string;
    productName: string;
    shopName: string;
    quantity: number;
    unitPrice?: number;
    totalAmount: number;
    status: string;
    deliveryType?: string;
    deliveredContent?: string;
    createdAt: string;
}

export default function OrdersPage() {
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        async function fetchOrders() {
            try {
                const res = await fetch('/api/v1/user/data?type=orders');
                const data = await res.json();
                const apiOrders = data.success ? (data.data as Order[]) : [];
                setOrders(apiOrders);
            } catch {
                setOrders([]);
            }
            setLoading(false);
        }
        fetchOrders();
    }, []);

    const handleCopy = (text: string) => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 text-brand-primary animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-xl font-bold text-brand-text-primary mb-1">Đơn hàng của tôi</h1>
                <p className="text-sm text-brand-text-muted">Theo dõi trạng thái xử lý, thông tin giao hàng và lịch sử mua hàng của bạn.</p>
            </div>

            {/* Toolbar */}
            <div className="card !p-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <div className="flex-1 relative">
                    <Search className="w-4 h-4 text-brand-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
                    <input type="text" placeholder="Tìm theo mã đơn, sản phẩm..." className="input-field !py-2 !pl-10 text-sm" />
                </div>
                <div className="flex gap-2">
                    <select className="input-field !py-2 text-sm min-w-[130px]">
                        <option>Tất cả trạng thái</option>
                        <option>Hoàn tất</option>
                        <option>Đã giao</option>
                        <option>Chờ giao</option>
                        <option>Đã hủy</option>
                    </select>
                    <button className="btn-secondary !px-3 !py-2 text-sm">
                        <Download className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Orders Table */}
            <div className="card !p-0 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-brand-surface-2/50">
                                <th className="text-left text-xs text-brand-text-muted font-medium py-3 px-4">Mã đơn</th>
                                <th className="text-left text-xs text-brand-text-muted font-medium py-3 px-4">Sản phẩm</th>
                                <th className="text-left text-xs text-brand-text-muted font-medium py-3 px-4">Gian hàng</th>
                                <th className="text-center text-xs text-brand-text-muted font-medium py-3 px-4">SL</th>
                                <th className="text-right text-xs text-brand-text-muted font-medium py-3 px-4">Tổng tiền</th>
                                <th className="text-center text-xs text-brand-text-muted font-medium py-3 px-4">Trạng thái</th>
                                <th className="text-right text-xs text-brand-text-muted font-medium py-3 px-4">Thời gian</th>
                                <th className="text-center text-xs text-brand-text-muted font-medium py-3 px-4">Thao tác</th>
                            </tr>
                        </thead>
                        <tbody>
                            {orders.map(order => (
                                <tr key={order.id} className="border-t border-brand-border/50 hover:bg-brand-surface-2/30 transition-colors">
                                    <td className="py-3 px-4 text-brand-primary font-medium text-xs">{order.orderCode}</td>
                                    <td className="py-3 px-4">
                                        <div className="flex items-center gap-2">
                                            <div className="w-8 h-8 rounded-lg bg-brand-primary/10 flex items-center justify-center shrink-0">
                                                <Package className="w-4 h-4 text-brand-primary" />
                                            </div>
                                            <span className="text-brand-text-primary text-xs truncate max-w-[180px]">{order.productName}</span>
                                        </div>
                                    </td>
                                    <td className="py-3 px-4 text-brand-text-secondary text-xs">{order.shopName}</td>
                                    <td className="py-3 px-4 text-center text-brand-text-primary">{order.quantity}</td>
                                    <td className="py-3 px-4 text-right font-semibold text-brand-text-primary">{formatCurrency(order.totalAmount)}</td>
                                    <td className="py-3 px-4 text-center">
                                        <span className={`badge text-[10px] ${order.status === 'completed' ? 'badge-success' :
                                            order.status === 'delivered' ? 'badge-info' :
                                                order.status === 'paid' ? 'badge-warning' :
                                                    order.status === 'delivering' ? 'badge-primary' : 'badge-neutral'
                                            }`}>
                                            {getStatusLabel(order.status)}
                                        </span>
                                    </td>
                                    <td className="py-3 px-4 text-right text-brand-text-muted text-xs">{formatDateTime(order.createdAt)}</td>
                                    <td className="py-3 px-4">
                                        <div className="flex items-center justify-center gap-1">
                                            <button onClick={() => setSelectedOrder(order)} className="p-1.5 rounded-lg text-brand-text-muted hover:text-brand-primary hover:bg-brand-surface-2 transition-all" title="Xem chi tiết">
                                                <Eye className="w-3.5 h-3.5" />
                                            </button>
                                            <button className="p-1.5 rounded-lg text-brand-text-muted hover:text-brand-warning hover:bg-brand-surface-2 transition-all" title="Tạo khiếu nại">
                                                <MessageSquare className="w-3.5 h-3.5" />
                                            </button>
                                            {order.status === 'completed' && (
                                                <button className="p-1.5 rounded-lg text-brand-text-muted hover:text-brand-warning hover:bg-brand-surface-2 transition-all" title="Đánh giá">
                                                    <Star className="w-3.5 h-3.5" />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Order Detail Modal */}
            {selectedOrder && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setSelectedOrder(null)} />
                    <div className="relative bg-brand-surface border border-brand-border rounded-2xl shadow-card-hover max-w-lg w-full p-6 animate-slide-up max-h-[80vh] overflow-y-auto">
                        <button onClick={() => setSelectedOrder(null)} className="absolute top-4 right-4 p-1 rounded-lg hover:bg-brand-surface-2">
                            <X className="w-5 h-5 text-brand-text-muted" />
                        </button>

                        <h2 className="text-lg font-bold text-brand-text-primary mb-4">Chi tiết đơn hàng</h2>

                        <div className="space-y-3 mb-4">
                            <div className="flex justify-between text-sm">
                                <span className="text-brand-text-muted">Mã đơn</span>
                                <span className="font-mono font-semibold text-brand-primary">{selectedOrder.orderCode}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-brand-text-muted">Sản phẩm</span>
                                <span className="text-brand-text-primary font-medium">{selectedOrder.productName}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-brand-text-muted">Gian hàng</span>
                                <span className="text-brand-text-secondary">{selectedOrder.shopName}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-brand-text-muted">Số lượng</span>
                                <span className="text-brand-text-primary">{selectedOrder.quantity}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-brand-text-muted">Tổng tiền</span>
                                <span className="text-brand-primary font-bold">{formatCurrency(selectedOrder.totalAmount)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-brand-text-muted">Trạng thái</span>
                                <span className={`badge text-[10px] ${selectedOrder.status === 'completed' ? 'badge-success' : selectedOrder.status === 'delivered' ? 'badge-info' : 'badge-warning'}`}>
                                    {getStatusLabel(selectedOrder.status)}
                                </span>
                            </div>
                        </div>

                        {selectedOrder.deliveredContent && (
                            <div className="bg-brand-surface-2 border border-brand-border rounded-xl p-4 mb-4">
                                <div className="flex items-center justify-between mb-2">
                                    <h3 className="text-sm font-semibold text-brand-text-primary flex items-center gap-2">
                                        <CheckCircle2 className="w-4 h-4 text-brand-success" /> Thông tin sản phẩm đã giao
                                    </h3>
                                    <button onClick={() => handleCopy(selectedOrder.deliveredContent!)} className="flex items-center gap-1 text-xs text-brand-primary hover:underline">
                                        <Copy className="w-3 h-3" /> {copied ? 'Đã copy!' : 'Copy'}
                                    </button>
                                </div>
                                <pre className="text-xs text-brand-text-secondary bg-brand-bg rounded-lg p-3 whitespace-pre-wrap font-mono border border-brand-border/50">
                                    {selectedOrder.deliveredContent}
                                </pre>
                            </div>
                        )}

                        <button onClick={() => setSelectedOrder(null)} className="btn-primary w-full !py-3">Đóng</button>
                    </div>
                </div>
            )}
        </div>
    );
}
