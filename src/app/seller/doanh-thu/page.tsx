import { formatCurrency } from '@/lib/utils';
import { TrendingUp, TrendingDown, DollarSign, ShoppingBag, BarChart3, ArrowUpRight, Calendar } from 'lucide-react';

const monthlyRevenue: { month: string; revenue: number }[] = [];

const topProducts: { name: string; revenue: number; orders: number; percentage: number }[] = [];

export default function RevenuePage() {
    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-bold text-brand-text-primary mb-1">Doanh thu</h1>
                    <p className="text-sm text-brand-text-muted">Tổng quan doanh thu, biểu đồ xu hướng và sản phẩm bán chạy.</p>
                </div>
                <div className="flex gap-2">
                    <select className="input-field !py-2 text-sm min-w-[130px]">
                        <option>Tháng này</option>
                        <option>Tháng trước</option>
                        <option>Quý này</option>
                        <option>Năm nay</option>
                    </select>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: 'Doanh thu tháng', value: formatCurrency(0), icon: DollarSign, change: 'Chưa có', up: true, bg: 'bg-brand-primary/10', color: 'text-brand-primary' },
                    { label: 'Đơn hàng tháng', value: '0', icon: ShoppingBag, change: 'Chưa có', up: true, bg: 'bg-brand-success/10', color: 'text-brand-success' },
                    { label: 'Doanh thu hôm nay', value: formatCurrency(0), icon: TrendingUp, change: 'Chưa có', up: true, bg: 'bg-brand-info/10', color: 'text-brand-info' },
                    { label: 'Giá trị TB/đơn', value: formatCurrency(0), icon: BarChart3, change: 'Chưa có', up: true, bg: 'bg-brand-warning/10', color: 'text-brand-warning' },
                ].map((s, i) => (
                    <div key={i} className="card">
                        <div className="flex items-center justify-between mb-3">
                            <div className={`w-10 h-10 rounded-xl ${s.bg} flex items-center justify-center`}>
                                <s.icon className={`w-5 h-5 ${s.color}`} />
                            </div>
                            <span className={`flex items-center gap-0.5 text-xs font-medium ${s.up ? 'text-brand-success' : 'text-brand-danger'}`}>
                                {s.up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                {s.change}
                            </span>
                        </div>
                        <div className="text-xl font-bold text-brand-text-primary">{s.value}</div>
                        <div className="text-xs text-brand-text-muted mt-1">{s.label}</div>
                    </div>
                ))}
            </div>

            {/* Revenue Chart (Simplified bar chart) */}
            <div className="card">
                <h3 className="text-sm font-semibold text-brand-text-primary mb-6">Doanh thu 6 tháng gần nhất</h3>
                <div className="flex items-end gap-3 h-48">
                    {monthlyRevenue.map((m, i) => {
                        const maxRevenue = Math.max(...monthlyRevenue.map(r => r.revenue));
                        const height = (m.revenue / maxRevenue) * 100;
                        const isLast = i === monthlyRevenue.length - 1;
                        return (
                            <div key={i} className="flex-1 flex flex-col items-center gap-2">
                                <div className="text-[10px] text-brand-text-muted font-medium">{formatCurrency(m.revenue)}</div>
                                <div className="w-full flex justify-center">
                                    <div
                                        className={`w-full max-w-[48px] rounded-t-lg transition-all ${isLast ? 'bg-gradient-to-t from-brand-primary to-brand-secondary' : 'bg-brand-surface-3 hover:bg-brand-primary/30'}`}
                                        style={{ height: `${height}%` }}
                                    />
                                </div>
                                <div className="text-xs text-brand-text-muted">{m.month}</div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Top Products */}
            <div className="card">
                <h3 className="text-sm font-semibold text-brand-text-primary mb-4">Sản phẩm bán chạy nhất</h3>
                <div className="space-y-3">
                    {topProducts.map((p, i) => (
                        <div key={i} className="flex items-center gap-4">
                            <div className="w-8 h-8 rounded-lg bg-brand-primary/10 flex items-center justify-center text-xs font-bold text-brand-primary shrink-0">
                                #{i + 1}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between mb-1">
                                    <span className="text-sm text-brand-text-primary font-medium truncate">{p.name}</span>
                                    <span className="text-sm font-semibold text-brand-text-primary shrink-0 ml-2">{formatCurrency(p.revenue)}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="flex-1 h-1.5 bg-brand-surface-3 rounded-full overflow-hidden">
                                        <div className="h-full bg-gradient-to-r from-brand-primary to-brand-secondary rounded-full" style={{ width: `${p.percentage}%` }} />
                                    </div>
                                    <span className="text-[10px] text-brand-text-muted shrink-0">{p.orders} đơn · {p.percentage}%</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
