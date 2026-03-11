import { formatCurrency, formatDateTime } from '@/lib/utils';
import { CheckCircle, XCircle, Clock, Eye, ArrowDownCircle } from 'lucide-react';

const deposits: { id: string; user: string; method: string; amount: number; status: string; createdAt: string }[] = [];

export default function AdminDepositsPage() {
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-xl font-bold text-brand-text-primary mb-1">Quản lý nạp tiền</h1>
                <p className="text-sm text-brand-text-muted">Theo dõi và xử lý các lệnh nạp tiền vào ví người dùng.</p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                    { label: 'Tổng nạp hôm nay', value: '0đ', color: 'text-brand-success' },
                    { label: 'Lệnh chờ xử lý', value: '0', color: 'text-brand-warning' },
                    { label: 'Hoàn tất', value: '0', color: 'text-brand-primary' },
                    { label: 'Thất bại', value: '0', color: 'text-brand-danger' },
                ].map((s, i) => (
                    <div key={i} className="card !p-4">
                        <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
                        <div className="text-xs text-brand-text-muted mt-1">{s.label}</div>
                    </div>
                ))}
            </div>
            <div className="card !p-0 overflow-hidden">
                <table className="w-full text-sm">
                    <thead><tr className="bg-brand-surface-2/50">
                        <th className="text-left text-xs text-brand-text-muted font-medium py-3 px-4">Mã</th>
                        <th className="text-left text-xs text-brand-text-muted font-medium py-3 px-4">Người dùng</th>
                        <th className="text-left text-xs text-brand-text-muted font-medium py-3 px-4">Phương thức</th>
                        <th className="text-right text-xs text-brand-text-muted font-medium py-3 px-4">Số tiền</th>
                        <th className="text-center text-xs text-brand-text-muted font-medium py-3 px-4">Trạng thái</th>
                        <th className="text-right text-xs text-brand-text-muted font-medium py-3 px-4">Thời gian</th>
                        <th className="text-center text-xs text-brand-text-muted font-medium py-3 px-4">Thao tác</th>
                    </tr></thead>
                    <tbody>
                        {deposits.map(d => (
                            <tr key={d.id} className="border-t border-brand-border/50 hover:bg-brand-surface-2/30">
                                <td className="py-3 px-4 text-brand-primary font-medium text-xs">{d.id}</td>
                                <td className="py-3 px-4 text-sm text-brand-text-primary">{d.user}</td>
                                <td className="py-3 px-4 text-xs text-brand-text-secondary">{d.method}</td>
                                <td className="py-3 px-4 text-right font-semibold text-brand-success">+{formatCurrency(d.amount)}</td>
                                <td className="py-3 px-4 text-center"><span className={`badge text-[10px] ${d.status === 'completed' ? 'badge-success' : d.status === 'pending' ? 'badge-warning' : 'badge-danger'}`}>{d.status === 'completed' ? 'Hoàn tất' : d.status === 'pending' ? 'Chờ xử lý' : 'Thất bại'}</span></td>
                                <td className="py-3 px-4 text-right text-xs text-brand-text-muted">{formatDateTime(d.createdAt)}</td>
                                <td className="py-3 px-4 text-center">
                                    {d.status === 'pending' ? (
                                        <div className="flex justify-center gap-1">
                                            <button className="p-1.5 rounded-lg text-brand-text-muted hover:text-brand-success hover:bg-brand-surface-2"><CheckCircle className="w-3.5 h-3.5" /></button>
                                            <button className="p-1.5 rounded-lg text-brand-text-muted hover:text-brand-danger hover:bg-brand-surface-2"><XCircle className="w-3.5 h-3.5" /></button>
                                        </div>
                                    ) : <button className="p-1.5 rounded-lg text-brand-text-muted hover:text-brand-primary hover:bg-brand-surface-2"><Eye className="w-3.5 h-3.5" /></button>}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
