import { Bell, ShoppingBag, Wallet, AlertTriangle, CheckCircle, Info, Trash2 } from 'lucide-react';

const notifications = [
    { id: 1, type: 'order', icon: ShoppingBag, title: 'Đơn hàng đã hoàn tất', message: 'Đơn hàng CTN-250308-001 đã được xử lý thành công. Kiểm tra thông tin sản phẩm trong mục đơn hàng.', time: '10 phút trước', isRead: false },
    { id: 2, type: 'wallet', icon: Wallet, title: 'Nạp tiền thành công', message: 'Bạn đã nạp thành công 500,000đ vào ví. Số dư hiện tại: 1,165,000đ.', time: '2 giờ trước', isRead: false },
    { id: 3, type: 'complaint', icon: AlertTriangle, title: 'Khiếu nại đã được phản hồi', message: 'Seller đã phản hồi khiếu nại KN-003. Vui lòng kiểm tra và xác nhận.', time: '5 giờ trước', isRead: true },
    { id: 4, type: 'system', icon: Info, title: 'Cập nhật hệ thống', message: 'Hệ thống sẽ bảo trì vào ngày 15/03/2026 từ 02:00 - 04:00. Một số tính năng có thể bị gián đoạn.', time: '1 ngày trước', isRead: true },
    { id: 5, type: 'order', icon: ShoppingBag, title: 'Sản phẩm đã được giao', message: 'Đơn hàng CTN-250305-002 đã được giao tự động. Thông tin sản phẩm có trong mục chi tiết đơn hàng.', time: '3 ngày trước', isRead: true },
    { id: 6, type: 'wallet', icon: Wallet, title: 'Hoàn tiền thành công', message: 'Đơn hàng CTN-250220-005 đã được hoàn tiền 250,000đ về ví.', time: '5 ngày trước', isRead: true },
    { id: 7, type: 'system', icon: CheckCircle, title: 'Xác minh tài khoản thành công', message: 'Tài khoản của bạn đã được xác minh. Bạn có thể sử dụng đầy đủ tính năng trên hệ thống.', time: '1 tuần trước', isRead: true },
];

export default function NotificationsPage() {
    const unreadCount = notifications.filter(n => !n.isRead).length;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-bold text-brand-text-primary mb-1">Thông báo</h1>
                    <p className="text-sm text-brand-text-muted">
                        {unreadCount > 0 ? `Bạn có ${unreadCount} thông báo chưa đọc.` : 'Tất cả thông báo đã được đọc.'}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button className="btn-secondary !py-2 !px-3 text-sm">Đánh dấu đã đọc tất cả</button>
                </div>
            </div>

            {/* Notification List */}
            <div className="space-y-2">
                {notifications.map(n => {
                    const IconComponent = n.icon;
                    return (
                        <div
                            key={n.id}
                            className={`card !p-4 flex items-start gap-4 cursor-pointer transition-all hover:border-brand-primary/30 ${!n.isRead ? 'border-brand-primary/20 bg-brand-primary/5' : ''
                                }`}
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
