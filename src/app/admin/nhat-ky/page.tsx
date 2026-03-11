import { Search, ClipboardList, User, Settings, ShoppingBag, CreditCard, Shield } from 'lucide-react';

const logs: { id: number; action: string; actor: string; target: string; type: string; time: string }[] = [];

const typeIcons: Record<string, typeof User> = {
    seller: Settings,
    product: ShoppingBag,
    order: ShoppingBag,
    finance: CreditCard,
    user: User,
    system: Shield,
    complaint: ClipboardList,
};

const typeColors: Record<string, string> = {
    seller: 'bg-brand-primary/10 text-brand-primary',
    product: 'bg-brand-warning/10 text-brand-warning',
    order: 'bg-brand-info/10 text-brand-info',
    finance: 'bg-brand-success/10 text-brand-success',
    user: 'bg-brand-danger/10 text-brand-danger',
    system: 'bg-brand-surface-3 text-brand-text-secondary',
    complaint: 'bg-brand-warning/10 text-brand-warning',
};

export default function AdminLogsPage() {
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-xl font-bold text-brand-text-primary mb-1">Nhật ký hoạt động</h1>
                <p className="text-sm text-brand-text-muted">Lịch sử tất cả hành động quản trị trên hệ thống.</p>
            </div>

            <div className="card !p-4 flex flex-col sm:flex-row gap-3">
                <div className="flex-1 relative">
                    <Search className="w-4 h-4 text-brand-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
                    <input type="text" placeholder="Tìm trong nhật ký..." className="input-field !py-2 !pl-10 text-sm" />
                </div>
                <select className="input-field !py-2 text-sm min-w-[130px]">
                    <option>Tất cả loại</option>
                    <option>Người dùng</option>
                    <option>Seller</option>
                    <option>Sản phẩm</option>
                    <option>Tài chính</option>
                    <option>Hệ thống</option>
                </select>
            </div>

            <div className="space-y-2">
                {logs.map(log => {
                    const IconComp = typeIcons[log.type] || ClipboardList;
                    const colorClass = typeColors[log.type] || 'bg-brand-surface-3 text-brand-text-secondary';
                    return (
                        <div key={log.id} className="card !p-4 flex items-center gap-4">
                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${colorClass}`}>
                                <IconComp className="w-4 h-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="text-sm text-brand-text-primary">
                                    <span className="font-medium">{log.actor}</span> — {log.action}
                                </div>
                                <div className="text-xs text-brand-text-muted truncate">{log.target}</div>
                            </div>
                            <span className="text-xs text-brand-text-muted shrink-0">{log.time}</span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
