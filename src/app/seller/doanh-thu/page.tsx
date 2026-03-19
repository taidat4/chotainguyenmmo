'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { formatCurrency } from '@/lib/utils';
import { TrendingUp, DollarSign, ShoppingBag, BarChart3, Loader2 } from 'lucide-react';

interface DashData {
    revenueToday: number; revenueMonth: number; newOrders: number;
    totalOrders: number; completedOrders: number; activeProducts: number;
}

export default function RevenuePage() {
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

    const d = data || { revenueToday: 0, revenueMonth: 0, newOrders: 0, totalOrders: 0, completedOrders: 0, activeProducts: 0 };
    const avgOrderValue = d.completedOrders > 0 ? Math.round(d.revenueMonth / d.completedOrders) : 0;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-bold text-brand-text-primary mb-1">Doanh thu</h1>
                    <p className="text-sm text-brand-text-muted">Tổng quan doanh thu và hiệu suất bán hàng.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: 'Doanh thu tháng', value: formatCurrency(d.revenueMonth), icon: DollarSign, bg: 'bg-brand-primary/10', color: 'text-brand-primary' },
                    { label: 'Đơn hàng tháng', value: String(d.completedOrders), icon: ShoppingBag, bg: 'bg-brand-success/10', color: 'text-brand-success' },
                    { label: 'Doanh thu hôm nay', value: formatCurrency(d.revenueToday), icon: TrendingUp, bg: 'bg-brand-info/10', color: 'text-brand-info' },
                    { label: 'Giá trị TB/đơn', value: formatCurrency(avgOrderValue), icon: BarChart3, bg: 'bg-brand-warning/10', color: 'text-brand-warning' },
                ].map((s, i) => (
                    <div key={i} className="card">
                        <div className="flex items-center justify-between mb-3">
                            <div className={`w-10 h-10 rounded-xl ${s.bg} flex items-center justify-center`}>
                                <s.icon className={`w-5 h-5 ${s.color}`} />
                            </div>
                        </div>
                        <div className="text-xl font-bold text-brand-text-primary">{s.value}</div>
                        <div className="text-xs text-brand-text-muted mt-1">{s.label}</div>
                    </div>
                ))}
            </div>

            <div className="card">
                <h3 className="text-sm font-semibold text-brand-text-primary mb-4">Tổng quan</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    <div className="bg-brand-surface-2 rounded-xl p-4 text-center">
                        <div className="text-2xl font-bold text-brand-primary">{d.totalOrders}</div>
                        <div className="text-xs text-brand-text-muted mt-1">Tổng đơn hàng</div>
                    </div>
                    <div className="bg-brand-surface-2 rounded-xl p-4 text-center">
                        <div className="text-2xl font-bold text-brand-success">{d.completedOrders}</div>
                        <div className="text-xs text-brand-text-muted mt-1">Đơn hoàn tất</div>
                    </div>
                    <div className="bg-brand-surface-2 rounded-xl p-4 text-center">
                        <div className="text-2xl font-bold text-brand-info">{d.activeProducts}</div>
                        <div className="text-xs text-brand-text-muted mt-1">Sản phẩm đang bán</div>
                    </div>
                </div>
            </div>
        </div>
    );
}
