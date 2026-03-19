'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { formatCurrency } from '@/lib/utils';
import {
    Users, Store, DollarSign, ShoppingBag, AlertTriangle,
    ArrowDownCircle, ArrowUpCircle, ArrowRight, TrendingUp,
    Package, Clock, CheckCircle, XCircle, Loader2
} from 'lucide-react';

interface DashStats {
    totalUsers: number;
    totalShops: number;
    totalOrders: number;
    ordersToday: number;
    totalRevenue: number;
    totalOrderRevenue: number;
    commissionRevenue: number;
    sellerPaidOut: number;
    pendingDeposits: number;
    pendingWithdrawals: number;
    openComplaints: number;
    recentUsers: { name: string; username: string; date: string }[];
    recentSellers: { name: string; owner: string; date: string }[];
}

export default function AdminDashboard() {
    const [stats, setStats] = useState<DashStats | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const token = localStorage.getItem('admin_token') || localStorage.getItem('token') || '';
        fetch('/api/v1/admin/stats', {
            headers: { Authorization: `Bearer ${token}` },
        }).then(r => r.json()).then(statsData => {
            if (statsData.success) setStats(statsData.data);
        }).catch(() => {}).finally(() => setLoading(false));
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-brand-primary" />
            </div>
        );
    }

    const d = stats || { totalUsers: 0, totalShops: 0, totalOrders: 0, ordersToday: 0, totalRevenue: 0, totalOrderRevenue: 0, commissionRevenue: 0, sellerPaidOut: 0, pendingDeposits: 0, pendingWithdrawals: 0, openComplaints: 0, recentUsers: [], recentSellers: [] };

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
                    { icon: DollarSign, label: 'Tổng nạp', value: formatCurrency(d.totalRevenue), color: 'text-brand-success', bg: 'bg-brand-success/10' },
                    { icon: TrendingUp, label: 'Tổng doanh thu web', value: formatCurrency(d.totalOrderRevenue), color: 'text-brand-danger', bg: 'bg-brand-danger/10' },
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
                    <h3 className="text-sm font-semibold text-brand-text-primary">Dòng tiền</h3>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {[
                        { label: 'Tiền vào (Nạp)', value: formatCurrency(d.totalRevenue), icon: ArrowDownCircle, color: 'text-brand-success', bg: 'bg-brand-success/10' },
                        { label: 'Hoa hồng sàn', value: formatCurrency(d.commissionRevenue), icon: DollarSign, color: 'text-brand-info', bg: 'bg-brand-info/10' },
                        { label: 'Tổng đơn hàng', value: d.totalOrders.toString(), icon: Package, color: 'text-brand-primary', bg: 'bg-brand-primary/10' },
                        { label: 'Seller nhận', value: formatCurrency(d.sellerPaidOut), icon: TrendingUp, color: 'text-brand-warning', bg: 'bg-brand-warning/10' },
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

            {/* Recent Items */}
            <div className="grid lg:grid-cols-2 gap-6">
                {/* Recent Users */}
                <div className="card">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-semibold text-brand-text-primary">Người dùng mới</h3>
                        <Link href="/admin/nguoi-dung" className="text-xs text-brand-primary hover:underline">Xem tất cả</Link>
                    </div>
                    <div className="space-y-3">
                        {d.recentUsers.length > 0 ? d.recentUsers.map((u, i) => (
                            <div key={i} className="flex items-center gap-3 bg-brand-surface-2 rounded-xl p-3">
                                <div className="w-9 h-9 rounded-lg bg-brand-primary/10 flex items-center justify-center shrink-0">
                                    <Users className="w-4 h-4 text-brand-primary" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="text-sm font-medium text-brand-text-primary truncate">{u.name}</div>
                                    <div className="text-xs text-brand-text-muted">@{u.username} • {u.date}</div>
                                </div>
                            </div>
                        )) : (
                            <p className="text-xs text-brand-text-muted text-center py-4">Chưa có người dùng</p>
                        )}
                    </div>
                </div>

                {/* Pending Sellers */}
                <div className="card">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-semibold text-brand-text-primary">Gian hàng chờ duyệt</h3>
                        <Link href="/admin/nguoi-ban" className="text-xs text-brand-primary hover:underline">Xem tất cả</Link>
                    </div>
                    <div className="space-y-3">
                        {d.recentSellers.length > 0 ? d.recentSellers.map((seller, i) => (
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
                        )) : (
                            <p className="text-xs text-brand-text-muted text-center py-4">Không có gian hàng chờ duyệt</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
