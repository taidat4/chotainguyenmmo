import { sampleTransactions } from '@/lib/mock-data';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import { ArrowDownLeft, ArrowUpRight, Search, Wallet } from 'lucide-react';

export default function AdminTransactionsPage() {
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-xl font-bold text-brand-text-primary mb-1">Giao dịch tài chính</h1>
                <p className="text-sm text-brand-text-muted">Theo dõi toàn bộ giao dịch nạp, rút, mua hàng và hoàn tiền trên hệ thống.</p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                    { label: 'Tổng nạp (tháng)', value: '0đ', color: 'text-brand-success' },
                    { label: 'Tổng chi (tháng)', value: '0đ', color: 'text-brand-danger' },
                    { label: 'Hoàn tiền', value: '0đ', color: 'text-brand-warning' },
                    { label: 'Giao dịch hôm nay', value: '0', color: 'text-brand-primary' },
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
                    <input type="text" placeholder="Tìm giao dịch..." className="input-field !py-2 !pl-10 text-sm" />
                </div>
                <select className="input-field !py-2 text-sm min-w-[120px]"><option>Tất cả</option><option>Nạp tiền</option><option>Thanh toán</option><option>Hoàn tiền</option></select>
            </div>
            <div className="card !p-0 overflow-hidden">
                <table className="w-full text-sm">
                    <thead><tr className="bg-brand-surface-2/50">
                        <th className="text-left text-xs text-brand-text-muted font-medium py-3 px-4">Loại</th>
                        <th className="text-left text-xs text-brand-text-muted font-medium py-3 px-4">Mô tả</th>
                        <th className="text-right text-xs text-brand-text-muted font-medium py-3 px-4">Số tiền</th>
                        <th className="text-right text-xs text-brand-text-muted font-medium py-3 px-4">Số dư sau</th>
                        <th className="text-right text-xs text-brand-text-muted font-medium py-3 px-4">Thời gian</th>
                    </tr></thead>
                    <tbody>
                        {sampleTransactions.map(t => (
                            <tr key={t.id} className="border-t border-brand-border/50 hover:bg-brand-surface-2/30">
                                <td className="py-3 px-4"><div className="flex items-center gap-2">
                                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${t.direction === 'credit' ? 'bg-brand-success/10' : 'bg-brand-danger/10'}`}>
                                        {t.direction === 'credit' ? <ArrowDownLeft className="w-3.5 h-3.5 text-brand-success" /> : <ArrowUpRight className="w-3.5 h-3.5 text-brand-danger" />}
                                    </div>
                                    <span className={`badge text-[10px] ${t.type === 'deposit' ? 'badge-success' : 'badge-warning'}`}>{t.type === 'deposit' ? 'Nạp' : 'Thanh toán'}</span>
                                </div></td>
                                <td className="py-3 px-4 text-xs text-brand-text-secondary">{t.description}</td>
                                <td className={`py-3 px-4 text-right font-semibold ${t.direction === 'credit' ? 'text-brand-success' : 'text-brand-danger'}`}>{t.direction === 'credit' ? '+' : '-'}{formatCurrency(t.amount)}</td>
                                <td className="py-3 px-4 text-right text-brand-text-primary">{formatCurrency(t.balanceAfter)}</td>
                                <td className="py-3 px-4 text-right text-xs text-brand-text-muted">{formatDateTime(t.createdAt)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
