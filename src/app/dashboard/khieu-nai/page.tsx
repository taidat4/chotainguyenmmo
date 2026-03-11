import { AlertTriangle, Plus, Eye, Clock, CheckCircle, XCircle, MessageSquare } from 'lucide-react';
import { formatDateTime, getStatusLabel } from '@/lib/utils';

const complaints = [
    { id: 'KN-001', orderCode: 'CTN-250301-001', productName: 'ChatGPT Plus - 1 tháng', reason: 'Tài khoản không đăng nhập được', status: 'open', createdAt: '2026-03-05T10:30:00' },
    { id: 'KN-002', orderCode: 'CTN-250225-003', productName: 'Canva Pro Team - 6 tháng', reason: 'Sai thông tin tài khoản', status: 'under_review', createdAt: '2026-02-28T14:15:00' },
    { id: 'KN-003', orderCode: 'CTN-250220-005', productName: 'Windows 11 Pro Key', reason: 'Key đã được sử dụng', status: 'resolved', createdAt: '2026-02-22T09:00:00' },
    { id: 'KN-004', orderCode: 'CTN-250210-002', productName: 'Spotify Premium - 3 tháng', reason: 'Không nhận được sản phẩm', status: 'rejected', createdAt: '2026-02-12T16:45:00' },
];

export default function ComplaintsPage() {
    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-bold text-brand-text-primary mb-1">Khiếu nại của tôi</h1>
                    <p className="text-sm text-brand-text-muted">Theo dõi tiến trình xử lý khiếu nại và trao đổi với người bán.</p>
                </div>
                <button className="btn-primary flex items-center gap-2 !py-2 text-sm">
                    <Plus className="w-4 h-4" /> Tạo khiếu nại
                </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                    { label: 'Tổng khiếu nại', value: '4', color: 'text-brand-text-primary' },
                    { label: 'Đang xử lý', value: '2', color: 'text-brand-warning' },
                    { label: 'Đã giải quyết', value: '1', color: 'text-brand-success' },
                    { label: 'Bị từ chối', value: '1', color: 'text-brand-danger' },
                ].map((stat, i) => (
                    <div key={i} className="card !p-4">
                        <div className={`text-xl font-bold ${stat.color}`}>{stat.value}</div>
                        <div className="text-xs text-brand-text-muted mt-1">{stat.label}</div>
                    </div>
                ))}
            </div>

            {/* Complaints List */}
            <div className="space-y-3">
                {complaints.map(c => (
                    <div key={c.id} className="card hover:border-brand-primary/30 transition-all cursor-pointer">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="text-xs text-brand-primary font-medium">{c.id}</span>
                                    <span className="text-xs text-brand-text-muted">·</span>
                                    <span className="text-xs text-brand-text-muted">{c.orderCode}</span>
                                </div>
                                <h3 className="text-sm font-semibold text-brand-text-primary truncate">{c.productName}</h3>
                                <p className="text-xs text-brand-text-secondary mt-1">{c.reason}</p>
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                                <div className="text-right">
                                    <span className={`badge text-[10px] ${c.status === 'open' ? 'badge-warning' :
                                            c.status === 'under_review' ? 'badge-info' :
                                                c.status === 'resolved' ? 'badge-success' : 'badge-danger'
                                        }`}>
                                        {getStatusLabel(c.status)}
                                    </span>
                                    <div className="text-[10px] text-brand-text-muted mt-1">{formatDateTime(c.createdAt)}</div>
                                </div>
                                <button className="p-2 rounded-xl text-brand-text-muted hover:text-brand-primary hover:bg-brand-surface-2 transition-all">
                                    <Eye className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Empty State Info */}
            <div className="card bg-brand-surface-2/30 border-dashed">
                <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-brand-warning shrink-0 mt-0.5" />
                    <div>
                        <h4 className="text-sm font-semibold text-brand-text-primary mb-1">Lưu ý khi tạo khiếu nại</h4>
                        <ul className="text-xs text-brand-text-secondary space-y-1">
                            <li>• Chỉ tạo khiếu nại trong thời gian cho phép sau khi nhận sản phẩm.</li>
                            <li>• Cung cấp đầy đủ bằng chứng (ảnh chụp màn hình, mô tả chi tiết).</li>
                            <li>• Hệ thống sẽ xem xét và phản hồi trong vòng 24-48 giờ.</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
}
