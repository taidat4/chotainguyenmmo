'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { formatCurrency } from '@/lib/utils';
import { adminDashboardData } from '@/lib/mock-data';
import {
    Users, Store, DollarSign, ShoppingBag, AlertTriangle,
    ArrowDownCircle, ArrowUpCircle, ArrowRight, TrendingUp,
    Package, Clock, CheckCircle, XCircle
} from 'lucide-react';

export default function AdminDashboard() {
    const d = adminDashboardData;
    const [stats, setStats] = useState({ totalPlatformFees: 0, totalRevenue: 0, totalOrders: 0, commissionRate: 5, totalSellerEarnings: 0 });

    useEffect(() => {
        fetch('/api/v1/admin/settings')
            .then(r => r.json())
            .then(data => { if (data.success) setStats(data.data.stats); })
            .catch(() => {});
    }, []);

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-xl font-bold text-brand-text-primary mb-1">Tổng quan hệ thống</h1>
                <p className="text-sm text-brand-text-muted">Theo dõi hoạt động toàn nền tảng, kiểm soát giao dịch, người dùng, gian hàng và các yêu cầu đang chờ xử lý.</p>
            </div>

            {/* Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { icon: Users, label: 'Tổng người dùng', value: d.totalUsers.toLocaleString(), color: 'text-brand-primary', bg: 'bg-brand-primary/10' },
                    { icon: Store, label: 'Tổng gian hàng', value: d.totalShops.toString(), color: 'text-brand-secondary', bg: 'bg-brand-secondary/10' },
                    { icon: DollarSign, label: 'Tổng doanh thu', value: formatCurrency(d.totalRevenue), color: 'text-brand-success', bg: 'bg-brand-success/10' },
                    { icon: ShoppingBag, label: 'Đơn hàng hôm nay', value: d.ordersToday.toString(), color: 'text-brand-info', bg: 'bg-brand-info/10' },
                ].map((m, i) => (
                    <div key={i} className="card">
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-xs text-brand-text-muted font-medium">{m.label}</span>
                            <div className={`w-9 h-9 rounded-xl ${m.bg} flex items-center justify-center`}>
                                <m.icon className={`w-5 h-5 ${m.color}`} />
                            </div>
                        </div>
                        <div className={`text-2xl font-bold ${m.color}`}>{m.value}</div>
                    </div>
                ))}
            </div>

            {/* Cash Flow Overview */}
            <div className="card">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-brand-text-primary">Dòng tiền tháng này</h3>
                    <span className="text-xs text-brand-text-muted">Tháng 3, 2026</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {[
                        { label: 'Tiền vào (Nạp)', value: '0đ', icon: ArrowDownCircle, color: 'text-brand-success', bg: 'bg-brand-success/10' },
                        { label: 'Tiền ra (Rút)', value: '0đ', icon: ArrowUpCircle, color: 'text-brand-danger', bg: 'bg-brand-danger/10' },
                        { label: 'Doanh thu ròng', value: formatCurrency(stats.totalRevenue), icon: TrendingUp, color: 'text-brand-primary', bg: 'bg-brand-primary/10' },
                        { label: `Hoa hồng sàn (${stats.commissionRate}%)`, value: formatCurrency(stats.totalPlatformFees), icon: DollarSign, color: 'text-brand-info', bg: 'bg-brand-info/10' },
                    ].map((item, i) => (
                        <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-brand-surface-2/50">
                            <div className={`w-10 h-10 rounded-xl ${item.bg} flex items-center justify-center shrink-0`}>
                                <item.icon className={`w-5 h-5 ${item.color}`} />
                            </div>
                            <div>
                                <div className={`text-sm font-bold ${item.color}`}>{item.value}</div>
                                <div className="text-[10px] text-brand-text-muted">{item.label}</div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Alerts Row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="card border-brand-danger/30 !bg-brand-danger/5">
                    <div className="flex items-center gap-3">
                        <AlertTriangle className="w-5 h-5 text-brand-danger" />
                        <div>
                            <div className="text-sm font-semibold text-brand-text-primary">{d.openComplaints} khiếu nại đang mở</div>
                            <Link href="/admin/khieu-nai" className="text-xs text-brand-danger hover:underline">Xem ngay →</Link>
                        </div>
                    </div>
                </div>
                <div className="card border-brand-warning/30 !bg-brand-warning/5">
                    <div className="flex items-center gap-3">
                        <ArrowDownCircle className="w-5 h-5 text-brand-warning" />
                        <div>
                            <div className="text-sm font-semibold text-brand-text-primary">{d.pendingDeposits} yêu cầu nạp chờ duyệt</div>
                            <Link href="/admin/nap-tien" className="text-xs text-brand-warning hover:underline">Xem ngay →</Link>
                        </div>
                    </div>
                </div>
                <div className="card border-brand-info/30 !bg-brand-info/5">
                    <div className="flex items-center gap-3">
                        <ArrowUpCircle className="w-5 h-5 text-brand-info" />
                        <div>
                            <div className="text-sm font-semibold text-brand-text-primary">{d.pendingWithdrawals} yêu cầu rút chờ duyệt</div>
                            <Link href="/admin/rut-tien" className="text-xs text-brand-info hover:underline">Xem ngay →</Link>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid lg:grid-cols-3 gap-6">
                {/* Revenue Chart */}
                <div className="lg:col-span-2 card">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-sm font-semibold text-brand-text-primary">Doanh thu 6 tháng gần đây</h3>
                        <span className="flex items-center gap-1 text-xs text-brand-success">
                            <TrendingUp className="w-3 h-3" /> +16.5%
                        </span>
                    </div>
                    <div className="flex items-end gap-3 h-52">
                        {d.revenueChart.map((item, i) => {
                            const maxRev = Math.max(...d.revenueChart.map(r => r.revenue));
                            const height = (item.revenue / maxRev) * 100;
                            return (
                                <div key={i} className="flex-1 flex flex-col items-center gap-2">
                                    <div className="text-[10px] text-brand-text-muted">{(item.revenue / 1000000).toFixed(0)}M</div>
                                    <div className="w-full relative group cursor-pointer">
                                        <div
                                            className="w-full rounded-t-xl bg-gradient-to-t from-brand-primary/50 to-brand-primary hover:from-brand-primary/70 hover:to-brand-primary transition-all"
                                            style={{ height: `${height * 1.8}px` }}
                                        />
                                    </div>
                                    <div className="text-[10px] text-brand-text-muted font-medium">{item.month}</div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Quick Actions / Activity */}
                <div className="card">
                    <h3 className="text-sm font-semibold text-brand-text-primary mb-4">Hoạt động gần đây</h3>
                    <div className="space-y-3">
                        {([] as { icon: typeof CheckCircle; text: string; time: string; color: string }[]).map((activity, i) => (
                            <div key={i} className="flex items-start gap-3 text-xs">
                                <activity.icon className={`w-4 h-4 ${activity.color} shrink-0 mt-0.5`} />
                                <div className="flex-1">
                                    <div className="text-brand-text-secondary">{activity.text}</div>
                                    <div className="text-brand-text-muted mt-0.5">{activity.time}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Recent Items */}
            <div className="grid lg:grid-cols-2 gap-6">
                {/* Pending Products */}
                <div className="card">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-semibold text-brand-text-primary">Sản phẩm chờ duyệt</h3>
                        <Link href="/admin/san-pham" className="text-xs text-brand-primary hover:underline">Xem tất cả</Link>
                    </div>
                    <div className="space-y-3">
                        {([] as { name: string; shop: string; price: number }[]).map((product, i) => (
                            <div key={i} className="flex items-center gap-3 bg-brand-surface-2 rounded-xl p-3">
                                <div className="w-9 h-9 rounded-lg bg-brand-warning/10 flex items-center justify-center shrink-0">
                                    <Clock className="w-4 h-4 text-brand-warning" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="text-sm font-medium text-brand-text-primary truncate">{product.name}</div>
                                    <div className="text-xs text-brand-text-muted">{product.shop}</div>
                                </div>
                                <div className="flex gap-1.5 shrink-0">
                                    <button className="px-2.5 py-1 rounded-lg bg-brand-success/10 text-brand-success text-xs font-medium hover:bg-brand-success/20 transition-all">Duyệt</button>
                                    <button className="px-2.5 py-1 rounded-lg bg-brand-danger/10 text-brand-danger text-xs font-medium hover:bg-brand-danger/20 transition-all">Từ chối</button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* New Sellers */}
                <div className="card">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-semibold text-brand-text-primary">Gian hàng mới đăng ký</h3>
                        <Link href="/admin/nguoi-ban" className="text-xs text-brand-primary hover:underline">Xem tất cả</Link>
                    </div>
                    <div className="space-y-3">
                        {([] as { name: string; owner: string; date: string }[]).map((seller, i) => (
                            <div key={i} className="flex items-center gap-3 bg-brand-surface-2 rounded-xl p-3">
                                <div className="w-9 h-9 rounded-lg bg-brand-secondary/10 flex items-center justify-center shrink-0">
                                    <Store className="w-4 h-4 text-brand-secondary" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="text-sm font-medium text-brand-text-primary truncate">{seller.name}</div>
                                    <div className="text-xs text-brand-text-muted">{seller.owner} • {seller.date}</div>
                                </div>
                                <div className="flex gap-1.5 shrink-0">
                                    <button className="px-2.5 py-1 rounded-lg bg-brand-success/10 text-brand-success text-xs font-medium hover:bg-brand-success/20 transition-all">Duyệt</button>
                                    <button className="px-2.5 py-1 rounded-lg bg-brand-surface-3 text-brand-text-muted text-xs font-medium hover:bg-brand-surface-2 transition-all">Chi tiết</button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
