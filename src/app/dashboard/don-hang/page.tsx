'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatCurrency } from '@/lib/utils';
import { useI18n } from '@/lib/i18n';
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
    const { t } = useI18n();
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
    const [copied, setCopied] = useState(false);
    const [searchCode, setSearchCode] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');

    const [complaintOrder, setComplaintOrder] = useState<Order | null>(null);
    const [complaintReason, setComplaintReason] = useState('');
    const [complaintSubmitting, setComplaintSubmitting] = useState(false);
    const [complaintSuccess, setComplaintSuccess] = useState(false);
    const [cancelOrder, setCancelOrder] = useState<Order | null>(null);

    const [reviewRating, setReviewRating] = useState(0);
    const [reviewHover, setReviewHover] = useState(0);
    const [reviewComment, setReviewComment] = useState('');
    const [reviewSubmitting, setReviewSubmitting] = useState(false);
    const [reviewDone, setReviewDone] = useState<Set<string>>(new Set());

    const getStatusLabel = (status: string) => {
        const map: Record<string, string> = {
            completed: t('ordCompleted'), delivered: t('ordDelivered'), paid: t('ordWaiting'),
            delivering: t('ordDelivering'), pending: t('ordPendingPayment'), cancelled: t('ordCancelled'),
            disputed: t('ordDisputed'), refunded: t('ordRefunded'),
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
                    productName: o.items?.[0]?.product?.name || t('productLabel'),
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

    useEffect(() => { fetchOrders(); }, []);

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

    const ratingLabels = [t('ordRate1'), t('ordRate2'), t('ordRate3'), t('ordRate4'), t('ordRate5')];

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-xl font-bold text-brand-text-primary mb-1">{t('ordTitle')}</h1>
                <p className="text-sm text-brand-text-muted">{t('ordSubtitle')}</p>
            </div>

            {/* Info Notice */}
            <div className="bg-brand-success/5 border border-brand-success/20 rounded-xl p-4">
                <div className="flex items-start gap-2 mb-2">
                    <Info className="w-4 h-4 text-brand-success mt-0.5 shrink-0" />
                    <span className="text-sm font-semibold text-brand-success">{t('ordNotice')}</span>
                </div>
                <ul className="space-y-1.5 text-xs text-brand-text-secondary ml-6 list-disc">
                    <li>{t('ordNotice1')}</li>
                    <li>{t('ordNotice2')}</li>
                    <li>{t('ordNotice3')}</li>
                    <li>{t('ordNotice4')}</li>
                </ul>
            </div>

            {/* Search / Filter Toolbar */}
            <div className="card !p-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <div className="flex-1 relative">
                    <Search className="w-4 h-4 text-brand-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
                    <input type="text" value={searchCode} onChange={e => setSearchCode(e.target.value)} placeholder={t('ordSearchPlaceholder')} className="input-field !py-2 !pl-10 text-sm" />
                </div>
                <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="input-field !py-2 text-sm min-w-[150px]">
                    <option value="all">{t('ordAllStatus')}</option>
                    <option value="completed">{t('ordCompleted')}</option>
                    <option value="delivered">{t('ordDelivered')}</option>
                    <option value="paid">{t('ordWaiting')}</option>
                    <option value="delivering">{t('ordDelivering')}</option>
                    <option value="pending">{t('ordPendingPayment')}</option>
                    <option value="cancelled">{t('ordCancelled')}</option>
                    <option value="disputed">{t('ordDisputed')}</option>
                </select>
                <button className="btn-primary !py-2 !px-5 text-sm whitespace-nowrap">{t('ordSearch')}</button>
            </div>

            {/* Orders Table */}
            <div className="card !p-0 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-brand-surface-2/50">
                                <th className="text-center text-xs text-brand-text-muted font-medium py-3 px-3 w-[70px]">{t('ordAction')}</th>
                                <th className="text-left text-xs text-brand-text-muted font-medium py-3 px-3">{t('ordCode')}</th>
                                <th className="text-left text-xs text-brand-text-muted font-medium py-3 px-3">{t('ordDate')}</th>
                                <th className="text-left text-xs text-brand-text-muted font-medium py-3 px-3">{t('ordShop')}</th>
                                <th className="text-left text-xs text-brand-text-muted font-medium py-3 px-3">{t('ordProduct')}</th>
                                <th className="text-left text-xs text-brand-text-muted font-medium py-3 px-3">{t('ordSeller')}</th>
                                <th className="text-center text-xs text-brand-text-muted font-medium py-3 px-3">{t('ordQty')}</th>
                                <th className="text-right text-xs text-brand-text-muted font-medium py-3 px-3">{t('ordUnitPrice')}</th>
                                <th className="text-right text-xs text-brand-text-muted font-medium py-3 px-3">{t('ordTotal')}</th>
                                <th className="text-center text-xs text-brand-text-muted font-medium py-3 px-3">{t('ordStatus')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.length === 0 ? (
                                <tr>
                                    <td colSpan={10} className="py-16 text-center">
                                        <Package className="w-10 h-10 mx-auto mb-3 text-brand-text-muted/30" />
                                        <p className="text-sm text-brand-text-muted">{t('ordNoOrders')}</p>
                                    </td>
                                </tr>
                            ) : (
                                filtered.map(order => {
                                    const unitPrice = order.unitPrice || (order.quantity > 0 ? Math.round(order.totalAmount / order.quantity) : order.totalAmount);
                                    return (
                                        <tr key={order.id} className="border-t border-brand-border/50 hover:bg-brand-surface-2/30 transition-colors">
                                            <td className="py-3 px-3">
                                                <div className="flex items-center justify-center gap-1">
                                                    <button
                                                        onClick={() => router.push(`/dashboard/tin-nhan?shop=${order.shopOwnerId || 'admin'}&orderId=${order.id}&orderCode=${encodeURIComponent(order.orderCode)}`)}
                                                        className="p-1.5 rounded-lg text-brand-text-muted hover:text-brand-info hover:bg-brand-surface-2 transition-all"
                                                        title={t('ordMsgSeller')}
                                                    >
                                                        <MessageSquare className="w-3.5 h-3.5" />
                                                    </button>
                                                    {order.status === 'disputed' ? (
                                                        <button
                                                            onClick={() => setCancelOrder(order)}
                                                            className="p-1.5 rounded-lg text-brand-danger hover:bg-red-50 transition-all animate-pulse"
                                                            title={t('ordCancelComplaint')}
                                                        >
                                                            <X className="w-3.5 h-3.5" />
                                                        </button>
                                                    ) : (
                                                        <button
                                                            onClick={() => { setComplaintOrder(order); setComplaintReason(''); setComplaintSuccess(false); }}
                                                            className="p-1.5 rounded-lg text-brand-text-muted hover:text-brand-warning hover:bg-brand-surface-2 transition-all"
                                                            title={t('ordComplaint')}
                                                        >
                                                            <AlertTriangle className="w-3.5 h-3.5" />
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="py-3 px-3">
                                                <button onClick={() => setSelectedOrder(order)} className="text-brand-primary font-medium text-xs hover:underline cursor-pointer font-mono">
                                                    {order.orderCode}
                                                </button>
                                            </td>
                                            <td className="py-3 px-3 text-xs text-brand-text-secondary whitespace-nowrap">{formatDate(order.createdAt)}</td>
                                            <td className="py-3 px-3 text-xs text-brand-text-secondary">{order.shopName}</td>
                                            <td className="py-3 px-3">
                                                <span className="text-xs text-brand-text-primary truncate max-w-[200px] block">{order.productName}</span>
                                            </td>
                                            <td className="py-3 px-3 text-xs text-brand-text-secondary">{order.sellerUsername || order.shopName}</td>
                                            <td className="py-3 px-3 text-center text-brand-text-primary text-xs">{order.quantity}</td>
                                            <td className="py-3 px-3 text-right text-xs text-brand-text-secondary">{formatCurrency(unitPrice)}</td>
                                            <td className="py-3 px-3 text-right font-semibold text-brand-text-primary text-xs">{formatCurrency(order.totalAmount)}</td>
                                            <td className="py-3 px-3 text-center">
                                                {order.status === 'disputed' ? (
                                                    <span className="inline-flex items-center gap-1 badge text-[10px] badge-danger animate-pulse">
                                                        <AlertTriangle className="w-3 h-3" /> {t('ordComplaint')}
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

                        <h2 className="text-lg font-bold text-brand-text-primary mb-4">{t('ordDetailTitle')}</h2>

                        <div className="space-y-3 mb-4">
                            <div className="flex justify-between text-sm">
                                <span className="text-brand-text-muted">{t('ordCode')}</span>
                                <span className="font-mono font-semibold text-brand-primary">{selectedOrder.orderCode}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-brand-text-muted">{t('ordDate')}</span>
                                <span className="text-brand-text-secondary">{formatDate(selectedOrder.createdAt)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-brand-text-muted">{t('ordProduct')}</span>
                                <span className="text-brand-text-primary font-medium text-right max-w-[60%]">{selectedOrder.productName}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-brand-text-muted">{t('ordShop')}</span>
                                <span className="text-brand-text-secondary">{selectedOrder.shopName}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-brand-text-muted">{t('ordSeller')}</span>
                                <span className="text-brand-text-secondary">{selectedOrder.sellerUsername || selectedOrder.shopName}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-brand-text-muted">{t('ordQty')}</span>
                                <span className="text-brand-text-primary">{selectedOrder.quantity}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-brand-text-muted">{t('ordUnitPrice')}</span>
                                <span className="text-brand-text-secondary">
                                    {formatCurrency(selectedOrder.unitPrice || (selectedOrder.quantity > 0 ? Math.round(selectedOrder.totalAmount / selectedOrder.quantity) : selectedOrder.totalAmount))}
                                </span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-brand-text-muted">{t('ordTotal')}</span>
                                <span className="text-brand-primary font-bold">{formatCurrency(selectedOrder.totalAmount)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-brand-text-muted">{t('ordStatus')}</span>
                                <span className={`badge text-[10px] ${getStatusClass(selectedOrder.status)}`}>
                                    {getStatusLabel(selectedOrder.status)}
                                </span>
                            </div>
                        </div>

                        {selectedOrder.deliveredContent && (
                            <div className="bg-brand-surface-2 border border-brand-border rounded-xl p-4 mb-4">
                                <div className="flex items-center justify-between mb-2">
                                    <h3 className="text-sm font-semibold text-brand-text-primary flex items-center gap-2">
                                        <CheckCircle2 className="w-4 h-4 text-brand-success" /> {t('ordDeliveredInfo')}
                                    </h3>
                                    <button onClick={() => handleCopy(selectedOrder.deliveredContent!)} className="flex items-center gap-1 text-xs text-brand-primary hover:underline">
                                        <Copy className="w-3 h-3" /> {copied ? t('ordCopied') : t('ordCopy')}
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
                                <h3 className="text-sm font-semibold text-brand-text-primary mb-3">{t('ordRateTitle')}</h3>
                                <div className="flex items-center gap-1 mb-3">
                                    {[1, 2, 3, 4, 5].map(star => (
                                        <button
                                            key={star}
                                            onClick={() => setReviewRating(star)}
                                            onMouseEnter={() => setReviewHover(star)}
                                            onMouseLeave={() => setReviewHover(0)}
                                            className="p-0.5 transition-transform hover:scale-110"
                                        >
                                            <Star className={`w-7 h-7 transition-colors ${star <= (reviewHover || reviewRating) ? 'text-yellow-400 fill-yellow-400' : 'text-brand-text-muted/30'}`} />
                                        </button>
                                    ))}
                                    {reviewRating > 0 && (
                                        <span className="text-sm text-brand-text-muted ml-2">
                                            {ratingLabels[reviewRating - 1]}
                                        </span>
                                    )}
                                </div>
                                <textarea
                                    value={reviewComment}
                                    onChange={e => setReviewComment(e.target.value)}
                                    placeholder={t('ordReviewPlaceholder')}
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
                                                showToast(data.message || t('ordReviewError'), 'error');
                                            }
                                        } catch { showToast(t('ordConnectError'), 'error'); }
                                        setReviewSubmitting(false);
                                    }}
                                    className="btn-primary !py-2 w-full text-sm flex items-center justify-center gap-2"
                                >
                                    {reviewSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Star className="w-4 h-4" />}
                                    {reviewSubmitting ? t('ordSending') : `${t('ordSubmitReview')} ${reviewRating > 0 ? `(${reviewRating} ${t('ordStars')})` : ''}`}
                                </button>
                            </div>
                        )}
                        {reviewDone.has(selectedOrder.id) && (
                            <div className="bg-brand-success/10 border border-brand-success/20 rounded-xl p-3 mb-4 text-center">
                                <CheckCircle2 className="w-5 h-5 text-brand-success mx-auto mb-1" />
                                <p className="text-sm text-brand-success font-medium">{t('ordReviewDone')}</p>
                            </div>
                        )}

                        <div className="flex gap-3">
                            <button onClick={() => { const o = selectedOrder; setSelectedOrder(null); setComplaintOrder(o); setComplaintReason(''); setComplaintSuccess(false); }} className="btn-secondary flex-1 !py-3 flex items-center justify-center gap-2 text-sm">
                                <AlertTriangle className="w-4 h-4" /> {t('ordComplaint')}
                            </button>
                            <button onClick={() => { const o = selectedOrder; setSelectedOrder(null); router.push(`/dashboard/tin-nhan?shop=${o.shopOwnerId || 'admin'}&orderId=${o.id}&orderCode=${encodeURIComponent(o.orderCode)}`); }} className="btn-secondary flex-1 !py-3 flex items-center justify-center gap-2 text-sm">
                                <MessageSquare className="w-4 h-4" /> {t('ordMsgSellerBtn')}
                            </button>
                            <button onClick={() => setSelectedOrder(null)} className="btn-primary flex-1 !py-3 text-sm">{t('ordClose')}</button>
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
                                <h2 className="text-lg font-bold text-brand-text-primary mb-2">{t('ordComplaintSent')}</h2>
                                <p className="text-sm text-brand-text-muted mb-4"><strong className="text-brand-primary font-mono">{complaintOrder.orderCode}</strong> {t('ordComplaintSentDesc')}</p>
                                <button onClick={() => setComplaintOrder(null)} className="btn-primary !py-2.5 !px-8 text-sm">{t('ordClose')}</button>
                            </div>
                        ) : (
                            <>
                                <div className="flex items-center gap-2 mb-4">
                                    <AlertTriangle className="w-5 h-5 text-brand-warning" />
                                    <h2 className="text-lg font-bold text-brand-text-primary">{t('ordComplaintTitle')}</h2>
                                </div>

                                <div className="bg-brand-surface-2 rounded-xl p-3 mb-4 text-sm">
                                    <div className="flex justify-between mb-1">
                                        <span className="text-brand-text-muted">{t('ordComplaintCode')}</span>
                                        <span className="font-mono text-brand-primary font-medium">{complaintOrder.orderCode}</span>
                                    </div>
                                    <div className="flex justify-between mb-1">
                                        <span className="text-brand-text-muted">{t('ordComplaintProduct')}</span>
                                        <span className="text-brand-text-primary font-medium">{complaintOrder.productName}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-brand-text-muted">{t('ordComplaintShop')}</span>
                                        <span className="text-brand-text-secondary">{complaintOrder.shopName}</span>
                                    </div>
                                </div>

                                <div className="mb-4">
                                    <label className="text-sm font-semibold text-brand-text-primary block mb-2">{t('ordComplaintReason')} <span className="text-brand-danger">*</span></label>
                                    <textarea
                                        value={complaintReason}
                                        onChange={e => setComplaintReason(e.target.value)}
                                        placeholder={t('ordComplaintPlaceholder')}
                                        rows={4}
                                        className="input-field text-sm resize-none"
                                    />
                                </div>

                                <div className="flex gap-3">
                                    <button onClick={() => setComplaintOrder(null)} className="btn-secondary flex-1 !py-3 text-sm">{t('ordClose')}</button>
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
                                        <Send className="w-4 h-4" /> {complaintSubmitting ? t('ordSending') : t('ordSendComplaint')}
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
                            <h3 className="text-base font-bold text-brand-text-primary mb-1">{t('ordCancelComplaintTitle')}</h3>
                            <p className="text-sm text-brand-text-muted">{t('ordCancelComplaintDesc')} <strong className="text-brand-primary font-mono">{cancelOrder.orderCode}</strong>?</p>
                            <p className="text-xs text-brand-text-muted mt-1">{t('ordCancelComplaintNote')}</p>
                        </div>
                        <div className="flex gap-3">
                            <button onClick={() => setCancelOrder(null)} className="btn-secondary flex-1 !py-2.5 text-sm">{t('ordKeep')}</button>
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
                                {t('ordConfirmCancel')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
