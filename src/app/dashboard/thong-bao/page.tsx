'use client';

import { Bell, ShoppingBag, Wallet, AlertTriangle, CheckCircle, Info, Trash2 } from 'lucide-react';
import { useI18n } from '@/lib/i18n';

const notifications = [
    { id: 1, type: 'order', icon: ShoppingBag, title: 'Đơn hàng đã hoàn tất', message: 'Đơn hàng CTN-250308-001 đã được xử lý thành công.', time: '10 phút trước', isRead: false },
    { id: 2, type: 'wallet', icon: Wallet, title: 'Nạp tiền thành công', message: 'Bạn đã nạp thành công 500,000đ vào ví.', time: '2 giờ trước', isRead: false },
    { id: 3, type: 'complaint', icon: AlertTriangle, title: 'Khiếu nại đã được phản hồi', message: 'Seller đã phản hồi khiếu nại KN-003.', time: '5 giờ trước', isRead: true },
    { id: 4, type: 'system', icon: Info, title: 'Cập nhật hệ thống', message: 'Hệ thống sẽ bảo trì ngày 15/03/2026.', time: '1 ngày trước', isRead: true },
];

export default function NotificationsPage() {
    const { t } = useI18n();

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-xl font-bold text-brand-text-primary mb-1">{t('notifsTitle')}</h1>
                <p className="text-sm text-brand-text-muted">{t('notifsSubtitle')}</p>
            </div>

            <div className="space-y-2">
                {notifications.map(n => {
                    const IconComponent = n.icon;
                    return (
                        <div
                            key={n.id}
                            className={`card !p-4 flex items-start gap-4 cursor-pointer transition-all hover:border-brand-primary/30 ${!n.isRead ? 'border-brand-primary/20 bg-brand-primary/5' : ''}`}
                        >
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${n.type === 'order' ? 'bg-brand-primary/10' :
                                    n.type === 'wallet' ? 'bg-brand-success/10' :
                                        n.type === 'complaint' ? 'bg-brand-warning/10' : 'bg-brand-info/10'
                                }`}>
                                <IconComponent className={`w-5 h-5 ${n.type === 'order' ? 'text-brand-primary' :
                                        n.type === 'wallet' ? 'text-brand-success' :
                                            n.type === 'complaint' ? 'text-brand-warning' : 'text-brand-info'
                                    }`} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-0.5">
                                    <h3 className="text-sm font-semibold text-brand-text-primary">{n.title}</h3>
                                    {!n.isRead && <div className="w-2 h-2 rounded-full bg-brand-primary shrink-0" />}
                                </div>
                                <p className="text-xs text-brand-text-secondary leading-relaxed">{n.message}</p>
                                <span className="text-[10px] text-brand-text-muted mt-1 block">{n.time}</span>
                            </div>
                            <button className="p-1.5 rounded-lg text-brand-text-muted hover:text-brand-danger hover:bg-brand-surface-2 transition-all shrink-0">
                                <Trash2 className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
