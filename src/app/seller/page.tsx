'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { formatCurrency } from '@/lib/utils';
import {
    TrendingUp, ShoppingBag, Package, AlertTriangle, Wallet, DollarSign,
    ArrowUpRight, Loader2
} from 'lucide-react';

interface DashData {
    revenueToday: number; revenueMonth: number; feesToday: number; feesMonth: number;
    commissionRate: number; heldBalance: number; availableBalance: number;
    newOrders: number; pendingWithdrawal: number;
    activeProducts: number; openComplaints: number; totalOrders: number; completedOrders: number;
    recentOrders: { id: string; orderCode: string; productName: string; buyerName: string; quantity: number; totalAmount: number; feeAmount: number; sellerEarning: number; status: string; createdAt: string }[];
}

export default function SellerDashboard() {
    const { user } = useAuth();
    const [data, setData] = useState<DashData | null>(null);
    const [loading, setLoading] = useState(true);
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') || '' : '';

    useEffect(() => {
        (async () => {
            try {
                const res = await fetch('/api/v1/seller/stats', { headers: { Authorization: `Bearer ${token}` } });
                const json = await res.json();
                if (json.success) setData(json.data);
            } catch { }
            setLoading(false);
        })();
    }, []);

    if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-brand-primary" /></div>;

    const d = data || { revenueToday: 0, revenueMonth: 0, feesToday: 0, feesMonth: 0, commissionRate: 5, heldBalance: 0, availableBalance: 0, newOrders: 0, pendingWithdrawal: 0, activeProducts: 0, openComplaints: 0, recentOrders: [] };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-xl font-bold text-brand-text-primary mb-1">Bảng điều khiển người bán</h1>
                <p className="text-sm text-brand-text-muted">Theo dõi doanh thu, đơn hàng, tồn kho, khiếu nại và hiệu suất gian hàng.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { icon: DollarSign, label: 'Doanh thu hôm nay (sau phí)', value: formatCurrency(d.revenueToday), color: 'text-brand-success', bg: 'bg-brand-success/10', href: '/seller/doanh-thu' },
                    { icon: TrendingUp, label: 'Doanh thu tháng (sau phí)', value: formatCurrency(d.revenueMonth), color: 'text-brand-primary', bg: 'bg-brand-primary/10', href: '/seller/doanh-thu' },
                    { icon: ShoppingBag, label: 'Đơn hàng mới', value: String(d.newOrders), color: 'text-brand-info', bg: 'bg-brand-info/10', href: '/seller/don-hang' },
                    { icon: Wallet, label: 'Đang tạm giữ (7 ngày)', value: formatCurrency(d.heldBalance), color: 'text-brand-warning', bg: 'bg-brand-warning/10', href: '/seller/rut-tien' },
                    { icon: Package, label: 'Sản phẩm đang bán', value: String(d.activeProducts), color: 'text-brand-text-primary', bg: 'bg-brand-surface-2', href: '/seller/san-pham' },
                    { icon: AlertTriangle, label: 'Khiếu nại cần xử lý', value: String(d.openComplaints), color: 'text-brand-danger', bg: 'bg-brand-danger/10', href: '/seller/khieu-nai' },
                ].map((m, i) => (
                    <Link key={i} href={m.href} className="card hover:border-brand-primary/30 hover:shadow-md transition-all cursor-pointer">
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-xs text-brand-text-muted font-medium">{m.label}</span>
                            <div className={`w-9 h-9 rounded-xl ${m.bg} flex items-center justify-center`}>
                                <m.icon className={`w-5 h-5 ${m.color}`} />
                            </div>
                        </div>
                        <div className={`text-2xl font-bold ${m.color}`}>{m.value}</div>
                    </Link>
                ))}
            </div>

            {/* Fee Info Banner */}
            <div className="card !p-4 bg-brand-warning/5 border-brand-warning/20">
                <div className="flex items-center gap-3 text-sm">
                    <div className="w-8 h-8 rounded-lg bg-brand-warning/10 flex items-center justify-center shrink-0">
                        <DollarSign className="w-4 h-4 text-brand-warning" />
                    </div>
                    <div className="flex-1">
                        <span className="font-medium text-brand-text-primary">Phí sàn: {d.commissionRate}%</span>
                        <span className="text-brand-text-muted ml-2">• Phí tháng này: <strong className="text-brand-danger">{formatCurrency(d.feesMonth)}</strong></span>
                        <span className="text-brand-text-muted ml-2">• Số dư khả dụng: <strong className="text-brand-success">{formatCurrency(d.availableBalance)}</strong></span>
                    </div>
                </div>
            </div>

            {/* Tax Info Banner */}
            <TaxInfoCard revenueMonth={d.revenueMonth} />
            <div className="card">
                <h3 className="text-sm font-semibold text-brand-text-primary mb-4">Đơn hàng mới nhất</h3>
                <div className="space-y-3">
                    {d.recentOrders.length === 0 ? (
                        <p className="text-sm text-brand-text-muted text-center py-6">Chưa có đơn hàng nào.</p>
                    ) : d.recentOrders.map((order) => (
                        <div key={order.id} className="flex items-center gap-4 bg-brand-surface-2 rounded-xl p-3">
                            <div className="w-9 h-9 rounded-lg bg-brand-primary/10 flex items-center justify-center shrink-0">
                                <ShoppingBag className="w-4 h-4 text-brand-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium text-brand-text-primary truncate">{order.productName}</div>
                                <div className="text-xs text-brand-text-muted">{order.orderCode} · x{order.quantity} · {order.buyerName}</div>
                            </div>
                            <div className="text-right">
                                <div className="text-sm font-semibold text-brand-text-primary">{formatCurrency(order.sellerEarning || order.totalAmount)}</div>
                                {order.feeAmount > 0 && (
                                    <div className="text-[10px] text-brand-text-muted">Phí: -{formatCurrency(order.feeAmount)}</div>
                                )}
                                <span className={`badge text-[10px] ${order.status === 'completed' ? 'badge-success' : order.status === 'paid' ? 'badge-info' : order.status === 'disputed' ? 'badge-danger' : 'badge-primary'}`}>
                                    {order.status === 'completed' ? 'Hoàn tất' : order.status === 'paid' ? 'Đã thanh toán' : order.status}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

// ======== Tax Info Card ========
function TaxInfoCard({ revenueMonth }: { revenueMonth: number }) {
    const [tax, setTax] = useState<{ enabled: boolean; taxRate: number; paymentDay: number } | null>(null);

    useEffect(() => {
        fetch('/api/v1/admin/tax').then(r => r.json()).then(d => {
            if (d.success) setTax(d.data);
        }).catch(() => {});
    }, []);

    if (!tax) return null;

    const estimatedTax = tax.enabled ? Math.floor(revenueMonth * tax.taxRate / 100) : 0;

    return (
        <div className={`card !p-4 ${tax.enabled ? 'border-brand-danger/20 bg-brand-danger/5' : 'border-brand-border bg-brand-surface-2/30'}`}>
            <div className="flex items-center gap-3 text-sm">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${tax.enabled ? 'bg-brand-danger/10' : 'bg-brand-surface-2'}`}>
                    📋
                </div>
                <div className="flex-1">
                    <span className="font-medium text-brand-text-primary">Đóng thuế: </span>
                    {tax.enabled ? (
                        <>
                            <span className="badge badge-danger text-[10px] mr-2">BẬT</span>
                            <span className="text-brand-text-muted">Thuế suất: <strong>{tax.taxRate}%</strong></span>
                            <span className="text-brand-text-muted ml-2">• Thu ngày: <strong>{tax.paymentDay}</strong> hàng tháng</span>
                            <span className="text-brand-text-muted ml-2">• Ước tính tháng này: <strong className="text-brand-danger">{formatCurrency(estimatedTax)}</strong></span>
                        </>
                    ) : (
                        <span className="badge badge-neutral text-[10px]">TẮT — Chưa thu thuế</span>
                    )}
                </div>
                <Link href="/seller/hoa-don" className="text-xs text-brand-primary hover:underline shrink-0">Xem hóa đơn →</Link>
            </div>
        </div>
    );
}
