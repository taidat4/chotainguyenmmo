'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatCurrency } from '@/lib/utils';
import { Search, MessageSquare, Package, Loader2, Copy, X, CheckCircle2, Info, AlertTriangle, Send, Star } from 'lucide-react';
import { useUI } from '@/components/shared/UIProvider';

interface Order {
    id: string;
    orderCode: string;
    productName: string;
    productId: string;
    shopName: string;
    shopSlug?: string;
    shopOwnerId?: string;
    sellerUsername?: string;
    quantity: number;
    unitPrice?: number;
    totalAmount: number;
    status: string;
    deliveryType?: string;
    deliveredContent?: string;
    createdAt: string;
}

const getStatusLabel = (status: string) => {
    const map: Record<string, string> = {
        completed: 'Hoàn tất', delivered: 'Đã giao', paid: 'Chờ giao',
        delivering: 'Đang giao', pending: 'Chờ thanh toán', cancelled: 'Đã hủy',
        disputed: 'Tranh chấp', refunded: 'Hoàn tiền',
    };
    return map[status] || status;
};

const getStatusClass = (status: string) => {
    const map: Record<string, string> = {
        completed: 'badge-success', delivered: 'badge-info', paid: 'badge-warning',
        delivering: 'badge-primary', pending: 'badge-neutral', cancelled: 'badge-danger',
        disputed: 'badge-danger', refunded: 'badge-warning',
    };
    return map[status] || 'badge-neutral';
};

const formatDate = (dateStr: string) => {
    try {
        const d = new Date(dateStr);
        const pad = (n: number) => String(n).padStart(2, '0');
        return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    } catch {
        return dateStr;
    }
};

export default function OrdersPage() {
    const router = useRouter();
    const { showToast } = useUI();
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
    const [copied, setCopied] = useState(false);
    const [searchCode, setSearchCode] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');

    // Complaint modal
    const [complaintOrder, setComplaintOrder] = useState<Order | null>(null);
    const [complaintReason, setComplaintReason] = useState('');
    const [complaintSubmitting, setComplaintSubmitting] = useState(false);
    const [complaintSuccess, setComplaintSuccess] = useState(false);
    const [cancelOrder, setCancelOrder] = useState<Order | null>(null);

    // Review state
    const [reviewRating, setReviewRating] = useState(0);
    const [reviewHover, setReviewHover] = useState(0);
    const [reviewComment, setReviewComment] = useState('');
    const [reviewSubmitting, setReviewSubmitting] = useState(false);
    const [reviewDone, setReviewDone] = useState<Set<string>>(new Set());

    const fetchOrders = async () => {
        try {
            const token = localStorage.getItem('token') || '';
            const res = await fetch('/api/v1/orders', {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json();
            if (data.success && data.data?.orders) {
                const mapped = data.data.orders.map((o: any) => ({
                    id: o.id,
                    orderCode: o.orderCode,
                    productName: o.items?.[0]?.product?.name || 'Sản phẩm',
                    shopName: o.shop?.name || '',
                    shopSlug: o.shop?.slug || '',
                    shopOwnerId: o.shop?.ownerId || '',
                    productId: o.items?.[0]?.productId || o.items?.[0]?.product?.id || '',
                    sellerUsername: o.shop?.name || '',
                    quantity: o.items?.[0]?.quantity || 1,
                    unitPrice: o.items?.[0]?.unitPrice || 0,
                    totalAmount: o.totalAmount,
                    status: o.status?.toLowerCase() || 'pending',
                    deliveryType: o.deliveryStatus,
                    deliveredContent: o.deliveries?.[0]?.content || '',
                    createdAt: o.createdAt,
                }));
                setOrders(mapped);
            } else {
                setOrders([]);
            }
        } catch {
            setOrders([]);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchOrders();
    }, []);

    const handleCopy = (text: string) => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const filtered = orders.filter(o => {
        const matchSearch = !searchCode || o.orderCode.toLowerCase().includes(searchCode.toLowerCase()) || o.productName.toLowerCase().includes(searchCode.toLowerCase());
        const matchStatus = statusFilter === 'all' || o.status === statusFilter;
        return matchSearch && matchStatus;
    });

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
                <h1 className="text-xl font-bold text-brand-text-primary mb-1">Đơn hàng đã mua</h1>
                <p className="text-sm text-brand-text-muted">Theo dõi trạng thái xử lý, thông tin giao hàng và lịch sử mua hàng của bạn.</p>
            </div>

            {/* Info Notice — like TapHoaMMO */}
            <div className="bg-brand-success/5 border border-brand-success/20 rounded-xl p-4">
                <div className="flex items-start gap-2 mb-2">
                    <Info className="w-4 h-4 text-brand-success mt-0.5 shrink-0" />
                    <span className="text-sm font-semibold text-brand-success">Xin lưu ý:</span>
                </div>
                <ul className="space-y-1.5 text-xs text-brand-text-secondary ml-6 list-disc">
                    <li>Bấm vào <strong className="text-brand-text-primary">MÃ ĐƠN HÀNG</strong> để xem chi tiết sản phẩm đã mua!</li>
                    <li>ChoTaiNguyen là sàn thương mại điện tử, vì vậy tính năng và chất lượng sản phẩm không thể nào rõ bằng người bán hàng, nếu có bất cứ thắc mắc gì về mặt hàng, xin liên hệ chủ shop để giải quyết hoặc bảo hành.</li>
                    <li>Trong trường hợp chủ shop không giải quyết hoặc giải quyết không thỏa đáng, hãy bấm vào <strong className="text-brand-text-primary">&quot;Khiếu nại đơn hàng&quot;</strong>, để bên mình có thể giữ tiền đơn hàng đó (lâu hơn 3 ngày) trong lúc bạn đợi phản hồi từ người bán.</li>
                    <li>Bên mình chỉ giữ tiền 3 ngày, trong trường hợp đơn hàng không có khiếu nại gì, tiền sẽ được chuyển cho người bán, vì vậy xin hãy <strong className="text-brand-text-primary">KIỂM TRA KỸ SẢN PHẨM</strong> sau khi mua.</li>
                </ul>
            </div>

            {/* Search / Filter Toolbar */}
            <div className="card !p-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <div className="flex-1 relative">
                    <Search className="w-4 h-4 text-brand-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                        type="text"
                        value={searchCode}
                        onChange={e => setSearchCode(e.target.value)}
                        placeholder="Nhập mã đơn hàng hoặc tên sản phẩm..."
                        className="input-field !py-2 !pl-10 text-sm"
                    />
                </div>
                <select
                    value={statusFilter}
                    onChange={e => setStatusFilter(e.target.value)}
                    className="input-field !py-2 text-sm min-w-[150px]"
                >
                    <option value="all">Tất cả trạng thái</option>
                    <option value="completed">Hoàn tất</option>
                    <option value="delivered">Đã giao</option>
                    <option value="paid">Chờ giao</option>
                    <option value="delivering">Đang giao</option>
                    <option value="pending">Chờ thanh toán</option>
                    <option value="cancelled">Đã hủy</option>
                    <option value="disputed">Tranh chấp</option>
                </select>
                <button className="btn-primary !py-2 !px-5 text-sm whitespace-nowrap">Tìm đơn hàng</button>
            </div>

            {/* Orders Table — TapHoaMMO style columns */}
            <div className="card !p-0 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-brand-surface-2/50">
                                <th className="text-center text-xs text-brand-text-muted font-medium py-3 px-3 w-[70px]">Thao tác</th>
                                <th className="text-left text-xs text-brand-text-muted font-medium py-3 px-3">Mã đơn hàng</th>
                                <th className="text-left text-xs text-brand-text-muted font-medium py-3 px-3">Ngày mua</th>
                                <th className="text-left text-xs text-brand-text-muted font-medium py-3 px-3">Gian hàng</th>
                                <th className="text-left text-xs text-brand-text-muted font-medium py-3 px-3">Mặt hàng</th>
                                <th className="text-left text-xs text-brand-text-muted font-medium py-3 px-3">Người bán</th>
                                <th className="text-center text-xs text-brand-text-muted font-medium py-3 px-3">Số lượng</th>
                                <th className="text-right text-xs text-brand-text-muted font-medium py-3 px-3">Đơn giá</th>
                                <th className="text-right text-xs text-brand-text-muted font-medium py-3 px-3">Tổng tiền</th>
                                <th className="text-center text-xs text-brand-text-muted font-medium py-3 px-3">Trạng thái</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.length === 0 ? (
                                <tr>
                                    <td colSpan={10} className="py-16 text-center">
                                        <Package className="w-10 h-10 mx-auto mb-3 text-brand-text-muted/30" />
                                        <p className="text-sm text-brand-text-muted">Chưa có đơn hàng nào.</p>
                                    </td>
                                </tr>
                            ) : (
                                filtered.map(order => {
                                    const unitPrice = order.unitPrice || (order.quantity > 0 ? Math.round(order.totalAmount / order.quantity) : order.totalAmount);
                                    return (
                                        <tr key={order.id} className="border-t border-brand-border/50 hover:bg-brand-surface-2/30 transition-colors">
                                            {/* Thao tác */}
                                            <td className="py-3 px-3">
                                                <div className="flex items-center justify-center gap-1">
                                                    <button
                                                        onClick={() => router.push(`/dashboard/tin-nhan?shop=${order.shopOwnerId || 'admin'}&orderId=${order.id}&orderCode=${encodeURIComponent(order.orderCode)}`)}
                                                        className="p-1.5 rounded-lg text-brand-text-muted hover:text-brand-info hover:bg-brand-surface-2 transition-all"
                                                        title="Nhắn tin seller"
                                                    >
                                                        <MessageSquare className="w-3.5 h-3.5" />
                                                    </button>
                                                    {order.status === 'disputed' ? (
                                                        <button
                                                            onClick={() => setCancelOrder(order)}
                                                            className="p-1.5 rounded-lg text-brand-danger hover:bg-red-50 transition-all animate-pulse"
                                                            title="Hủy khiếu nại"
                                                        >
                                                            <X className="w-3.5 h-3.5" />
                                                        </button>
                                                    ) : (
                                                        <button
                                                            onClick={() => { setComplaintOrder(order); setComplaintReason(''); setComplaintSuccess(false); }}
                                                            className="p-1.5 rounded-lg text-brand-text-muted hover:text-brand-warning hover:bg-brand-surface-2 transition-all"
                                                            title="Khiếu nại"
                                                        >
                                                            <AlertTriangle className="w-3.5 h-3.5" />
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                            {/* Mã đơn hàng */}
                                            <td className="py-3 px-3">
                                                <button
                                                    onClick={() => setSelectedOrder(order)}
                                                    className="text-brand-primary font-medium text-xs hover:underline cursor-pointer font-mono"
                                                >
                                                    {order.orderCode}
                                                </button>
                                            </td>
                                            {/* Ngày mua */}
                                            <td className="py-3 px-3 text-xs text-brand-text-secondary whitespace-nowrap">
                                                {formatDate(order.createdAt)}
                                            </td>
                                            {/* Gian hàng */}
                                            <td className="py-3 px-3 text-xs text-brand-text-secondary">{order.shopName}</td>
                                            {/* Mặt hàng */}
                                            <td className="py-3 px-3">
                                                <span className="text-xs text-brand-text-primary truncate max-w-[200px] block">{order.productName}</span>
                                            </td>
                                            {/* Người bán */}
                                            <td className="py-3 px-3 text-xs text-brand-text-secondary">{order.sellerUsername || order.shopName}</td>
                                            {/* Số lượng */}
                                            <td className="py-3 px-3 text-center text-brand-text-primary text-xs">{order.quantity}</td>
                                            {/* Đơn giá */}
                                            <td className="py-3 px-3 text-right text-xs text-brand-text-secondary">{formatCurrency(unitPrice)}</td>
                                            {/* Tổng tiền */}
                                            <td className="py-3 px-3 text-right font-semibold text-brand-text-primary text-xs">{formatCurrency(order.totalAmount)}</td>
                                            {/* Trạng thái */}
                                            <td className="py-3 px-3 text-center">
                                                {order.status === 'disputed' ? (
                                                    <span className="inline-flex items-center gap-1 badge text-[10px] badge-danger animate-pulse">
                                                        <AlertTriangle className="w-3 h-3" /> Khiếu nại
                                                    </span>
                                                ) : (
                                                    <span className={`badge text-[10px] ${getStatusClass(order.status)}`}>
                                                        {getStatusLabel(order.status)}
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
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
                                <span className="text-brand-text-muted">Mã đơn hàng</span>
                                <span className="font-mono font-semibold text-brand-primary">{selectedOrder.orderCode}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-brand-text-muted">Ngày mua</span>
                                <span className="text-brand-text-secondary">{formatDate(selectedOrder.createdAt)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-brand-text-muted">Mặt hàng</span>
                                <span className="text-brand-text-primary font-medium text-right max-w-[60%]">{selectedOrder.productName}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-brand-text-muted">Gian hàng</span>
                                <span className="text-brand-text-secondary">{selectedOrder.shopName}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-brand-text-muted">Người bán</span>
                                <span className="text-brand-text-secondary">{selectedOrder.sellerUsername || selectedOrder.shopName}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-brand-text-muted">Số lượng</span>
                                <span className="text-brand-text-primary">{selectedOrder.quantity}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-brand-text-muted">Đơn giá</span>
                                <span className="text-brand-text-secondary">
                                    {formatCurrency(selectedOrder.unitPrice || (selectedOrder.quantity > 0 ? Math.round(selectedOrder.totalAmount / selectedOrder.quantity) : selectedOrder.totalAmount))}
                                </span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-brand-text-muted">Tổng tiền</span>
                                <span className="text-brand-primary font-bold">{formatCurrency(selectedOrder.totalAmount)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-brand-text-muted">Trạng thái</span>
                                <span className={`badge text-[10px] ${getStatusClass(selectedOrder.status)}`}>
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

                        {/* Star Rating Section */}
                        {['completed', 'paid', 'delivered'].includes(selectedOrder.status) && !reviewDone.has(selectedOrder.id) && (
                            <div className="bg-brand-surface-2 border border-brand-border rounded-xl p-4 mb-4">
                                <h3 className="text-sm font-semibold text-brand-text-primary mb-3">⭐ Đánh giá đơn hàng</h3>
                                <div className="flex items-center gap-1 mb-3">
                                    {[1, 2, 3, 4, 5].map(star => (
                                        <button
                                            key={star}
                                            onClick={() => setReviewRating(star)}
                                            onMouseEnter={() => setReviewHover(star)}
                                            onMouseLeave={() => setReviewHover(0)}
                                            className="p-0.5 transition-transform hover:scale-110"
                                        >
                                            <Star
                                                className={`w-7 h-7 transition-colors ${
                                                    star <= (reviewHover || reviewRating)
                                                        ? 'text-yellow-400 fill-yellow-400'
                                                        : 'text-brand-text-muted/30'
                                                }`}
                                            />
                                        </button>
                                    ))}
                                    {reviewRating > 0 && (
                                        <span className="text-sm text-brand-text-muted ml-2">
                                            {reviewRating === 1 ? 'Tệ' : reviewRating === 2 ? 'Không hài lòng' : reviewRating === 3 ? 'Bình thường' : reviewRating === 4 ? 'Hài lòng' : 'Xuất sắc'}
                                        </span>
                                    )}
                                </div>
                                <textarea
                                    value={reviewComment}
                                    onChange={e => setReviewComment(e.target.value)}
                                    placeholder="Nhận xét về sản phẩm (không bắt buộc)..."
                                    className="input-field !py-2 text-sm w-full resize-none h-16 mb-3"
                                />
                                <button
                                    disabled={reviewRating === 0 || reviewSubmitting}
                                    onClick={async () => {
                                        if (!reviewRating || !selectedOrder.productId) return;
                                        setReviewSubmitting(true);
                                        try {
                                            const token = localStorage.getItem('token') || '';
                                            const res = await fetch('/api/v1/reviews', {
                                                method: 'POST',
                                                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                                                body: JSON.stringify({
                                                    orderId: selectedOrder.id,
                                                    productId: selectedOrder.productId,
                                                    rating: reviewRating,
                                                    comment: reviewComment || null,
                                                }),
                                            });
                                            const data = await res.json();
                                            if (data.success) {
                                                setReviewDone(prev => new Set([...prev, selectedOrder.id]));
                                                setReviewRating(0);
                                                setReviewComment('');
                                            } else {
                                                showToast(data.message || 'Lỗi gửi đánh giá', 'error');
                                            }
                                        } catch { showToast('Lỗi kết nối', 'error'); }
                                        setReviewSubmitting(false);
                                    }}
                                    className="btn-primary !py-2 w-full text-sm flex items-center justify-center gap-2"
                                >
                                    {reviewSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Star className="w-4 h-4" />}
                                    {reviewSubmitting ? 'Đang gửi...' : `Gửi đánh giá ${reviewRating > 0 ? `(${reviewRating} sao)` : ''}`}
                                </button>
                            </div>
                        )}
                        {reviewDone.has(selectedOrder.id) && (
                            <div className="bg-brand-success/10 border border-brand-success/20 rounded-xl p-3 mb-4 text-center">
                                <CheckCircle2 className="w-5 h-5 text-brand-success mx-auto mb-1" />
                                <p className="text-sm text-brand-success font-medium">Đã đánh giá đơn hàng này!</p>
                            </div>
                        )}

                        <div className="flex gap-3">
                            <button onClick={() => { const o = selectedOrder; setSelectedOrder(null); setComplaintOrder(o); setComplaintReason(''); setComplaintSuccess(false); }} className="btn-secondary flex-1 !py-3 flex items-center justify-center gap-2 text-sm">
                                <AlertTriangle className="w-4 h-4" /> Khiếu nại
                            </button>
                            <button onClick={() => { const o = selectedOrder; setSelectedOrder(null); router.push(`/dashboard/tin-nhan?shop=${o.shopOwnerId || 'admin'}&orderId=${o.id}&orderCode=${encodeURIComponent(o.orderCode)}`); }} className="btn-secondary flex-1 !py-3 flex items-center justify-center gap-2 text-sm">
                                <MessageSquare className="w-4 h-4" /> Nhắn seller
                            </button>
                            <button onClick={() => setSelectedOrder(null)} className="btn-primary flex-1 !py-3 text-sm">Đóng</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Complaint Modal */}
            {complaintOrder && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setComplaintOrder(null)} />
                    <div className="relative bg-brand-surface border border-brand-border rounded-2xl shadow-card-hover max-w-lg w-full p-6 animate-slide-up">
                        <button onClick={() => setComplaintOrder(null)} className="absolute top-4 right-4 p-1 rounded-lg hover:bg-brand-surface-2">
                            <X className="w-5 h-5 text-brand-text-muted" />
                        </button>

                        {complaintSuccess ? (
                            <div className="text-center py-6">
                                <CheckCircle2 className="w-14 h-14 text-brand-success mx-auto mb-3" />
                                <h2 className="text-lg font-bold text-brand-text-primary mb-2">Khiếu nại đã gửi!</h2>
                                <p className="text-sm text-brand-text-muted mb-4">Đơn hàng <strong className="text-brand-primary font-mono">{complaintOrder.orderCode}</strong> đang được xem xét. Admin sẽ phản hồi trong 24-48 giờ.</p>
                                <button onClick={() => setComplaintOrder(null)} className="btn-primary !py-2.5 !px-8 text-sm">Đóng</button>
                            </div>
                        ) : (
                            <>
                                <div className="flex items-center gap-2 mb-4">
                                    <AlertTriangle className="w-5 h-5 text-brand-warning" />
                                    <h2 className="text-lg font-bold text-brand-text-primary">Khiếu nại đơn hàng</h2>
                                </div>

                                <div className="bg-brand-surface-2 rounded-xl p-3 mb-4 text-sm">
                                    <div className="flex justify-between mb-1">
                                        <span className="text-brand-text-muted">Mã đơn</span>
                                        <span className="font-mono text-brand-primary font-medium">{complaintOrder.orderCode}</span>
                                    </div>
                                    <div className="flex justify-between mb-1">
                                        <span className="text-brand-text-muted">Sản phẩm</span>
                                        <span className="text-brand-text-primary font-medium">{complaintOrder.productName}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-brand-text-muted">Gian hàng</span>
                                        <span className="text-brand-text-secondary">{complaintOrder.shopName}</span>
                                    </div>
                                </div>

                                <div className="mb-4">
                                    <label className="text-sm font-semibold text-brand-text-primary block mb-2">Lý do khiếu nại <span className="text-brand-danger">*</span></label>
                                    <textarea
                                        value={complaintReason}
                                        onChange={e => setComplaintReason(e.target.value)}
                                        placeholder="Mô tả chi tiết vấn đề bạn gặp phải (VD: tài khoản không đăng nhập được, key đã sử dụng, không nhận được sản phẩm...)"
                                        rows={4}
                                        className="input-field text-sm resize-none"
                                    />
                                </div>

                                <div className="flex gap-3">
                                    <button onClick={() => setComplaintOrder(null)} className="btn-secondary flex-1 !py-3 text-sm">Đóng</button>
                                    <button
                                        onClick={async () => {
                                            if (!complaintReason.trim()) return;
                                            setComplaintSubmitting(true);
                                            try {
                                                const token = localStorage.getItem('token') || '';
                                                await fetch('/api/v1/complaints', {
                                                    method: 'POST',
                                                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                                                    body: JSON.stringify({ orderCode: complaintOrder.orderCode, reason: complaintReason.trim() }),
                                                });
                                                setComplaintSuccess(true);
                                                fetchOrders();
                                            } catch {}
                                            setComplaintSubmitting(false);
                                        }}
                                        disabled={!complaintReason.trim() || complaintSubmitting}
                                        className="btn-primary flex-1 !py-3 flex items-center justify-center gap-2 text-sm disabled:opacity-50"
                                    >
                                        <Send className="w-4 h-4" /> {complaintSubmitting ? 'Đang gửi...' : 'Gửi khiếu nại'}
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* Cancel Complaint Modal */}
            {cancelOrder && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setCancelOrder(null)} />
                    <div className="relative bg-brand-surface border border-brand-border rounded-2xl shadow-card-hover max-w-sm w-full p-6 animate-slide-up">
                        <div className="text-center mb-4">
                            <div className="w-14 h-14 rounded-full bg-brand-warning/10 flex items-center justify-center mx-auto mb-3">
                                <AlertTriangle className="w-7 h-7 text-brand-warning" />
                            </div>
                            <h3 className="text-base font-bold text-brand-text-primary mb-1">Hủy khiếu nại?</h3>
                            <p className="text-sm text-brand-text-muted">Bạn có chắc muốn hủy khiếu nại đơn hàng <strong className="text-brand-primary font-mono">{cancelOrder.orderCode}</strong>?</p>
                            <p className="text-xs text-brand-text-muted mt-1">Đơn hàng sẽ trở về trạng thái hoàn tất.</p>
                        </div>
                        <div className="flex gap-3">
                            <button onClick={() => setCancelOrder(null)} className="btn-secondary flex-1 !py-2.5 text-sm">Giữ lại</button>
                            <button
                                onClick={async () => {
                                    const token = localStorage.getItem('token') || '';
                                    await fetch(`/api/v1/complaints?orderCode=${cancelOrder.orderCode}`, {
                                        method: 'DELETE',
                                        headers: { Authorization: `Bearer ${token}` },
                                    });
                                    setCancelOrder(null);
                                    fetchOrders();
                                }}
                                className="flex-1 !py-2.5 text-sm rounded-xl font-medium bg-brand-danger text-white hover:brightness-110 transition-all"
                            >
                                Xác nhận hủy
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
