'use client';

import { formatCurrency } from '@/lib/utils';
import { sellerDashboardData } from '@/lib/mock-data';
import {
    TrendingUp, ShoppingBag, Package, AlertTriangle, Wallet, DollarSign,
    ArrowUpRight, ArrowRight
} from 'lucide-react';

export default function SellerDashboard() {
    const d = sellerDashboardData;

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-xl font-bold text-brand-text-primary mb-1">Bảng điều khiển người bán</h1>
                <p className="text-sm text-brand-text-muted">Theo dõi doanh thu, đơn hàng, tồn kho, khiếu nại và hiệu suất gian hàng trong một màn hình tổng quan.</p>
            </div>

            {/* Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {[
                    { icon: DollarSign, label: 'Doanh thu hôm nay', value: formatCurrency(d.revenueToday), color: 'text-brand-success', bg: 'bg-brand-success/10', change: '+12%' },
                    { icon: TrendingUp, label: 'Doanh thu tháng này', value: formatCurrency(d.revenueMonth), color: 'text-brand-primary', bg: 'bg-brand-primary/10', change: '+8%' },
                    { icon: ShoppingBag, label: 'Đơn hàng mới', value: d.newOrders.toString(), color: 'text-brand-info', bg: 'bg-brand-info/10' },
                    { icon: Wallet, label: 'Số dư chờ rút', value: formatCurrency(d.pendingWithdrawal), color: 'text-brand-warning', bg: 'bg-brand-warning/10' },
                    { icon: Package, label: 'Sản phẩm đang bán', value: d.activeProducts.toString(), color: 'text-brand-text-primary', bg: 'bg-brand-surface-2' },
                    { icon: AlertTriangle, label: 'Khiếu nại cần xử lý', value: d.openComplaints.toString(), color: 'text-brand-danger', bg: 'bg-brand-danger/10' },
                ].map((m, i) => (
                    <div key={i} className="card">
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-xs text-brand-text-muted font-medium">{m.label}</span>
                            <div className={`w-9 h-9 rounded-xl ${m.bg} flex items-center justify-center`}>
                                <m.icon className={`w-5 h-5 ${m.color}`} />
                            </div>
                        </div>
                        <div className={`text-2xl font-bold ${m.color}`}>{m.value}</div>
                        {m.change && (
                            <div className="flex items-center gap-1 mt-1 text-xs text-brand-success">
                                <ArrowUpRight className="w-3 h-3" /> {m.change} so với hôm qua
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Revenue Chart */}
            <div className="card">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-sm font-semibold text-brand-text-primary">Doanh thu 9 ngày gần đây</h3>
                    <span className="badge-success">Đang tăng</span>
                </div>
                <div className="flex items-end gap-2 h-48">
                    {d.revenueChart.map((item, i) => {
                        const maxRev = Math.max(...d.revenueChart.map(r => r.revenue));
                        const height = (item.revenue / maxRev) * 100;
                        return (
                            <div key={i} className="flex-1 flex flex-col items-center gap-2">
                                <div className="text-[10px] text-brand-text-muted">{formatCurrency(item.revenue).replace('₫', '')}</div>
                                <div className="w-full relative group">
                                    <div
                                        className="w-full rounded-t-lg bg-gradient-to-t from-brand-primary/60 to-brand-primary hover:from-brand-primary/80 hover:to-brand-primary transition-all cursor-pointer"
                                        style={{ height: `${height * 1.5}px` }}
                                    />
                                </div>
                                <div className="text-[10px] text-brand-text-muted">{item.date}</div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Recent Orders */}
            <div className="card">
                <h3 className="text-sm font-semibold text-brand-text-primary mb-4">Đơn hàng mới nhất</h3>
                <div className="space-y-3">
                    {([] as { code: string; product: string; qty: number; total: number; status: string }[]).map((order, i) => (
                        <div key={i} className="flex items-center gap-4 bg-brand-surface-2 rounded-xl p-3">
                            <div className="w-9 h-9 rounded-lg bg-brand-primary/10 flex items-center justify-center shrink-0">
                                <ShoppingBag className="w-4 h-4 text-brand-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium text-brand-text-primary truncate">{order.product}</div>
                                <div className="text-xs text-brand-text-muted">{order.code} • x{order.qty}</div>
                            </div>
                            <div className="text-right">
                                <div className="text-sm font-semibold text-brand-text-primary">{formatCurrency(order.total)}</div>
                                <span className={`badge text-[10px] ${order.status === 'Hoàn tất' ? 'badge-success' : order.status === 'Đã giao' ? 'badge-info' : 'badge-primary'}`}>
                                    {order.status}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
