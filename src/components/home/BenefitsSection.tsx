import { Zap, LayoutDashboard, Eye, Headphones } from 'lucide-react';

const benefits = [
    {
        icon: Zap,
        title: 'Giao dịch nhanh',
        description: 'Hoàn tất mua hàng và nhận thông tin trong thời gian ngắn với quy trình rõ ràng, tối ưu thao tác.',
    },
    {
        icon: LayoutDashboard,
        title: 'Quản lý thuận tiện',
        description: 'Theo dõi ví, đơn hàng, lịch sử giao dịch và thông báo ngay trong một bảng điều khiển thống nhất.',
    },
    {
        icon: Eye,
        title: 'Hệ thống minh bạch',
        description: 'Tình trạng đơn hàng, thời gian xử lý, lịch sử giao dịch và phản hồi được hiển thị rõ ràng.',
    },
    {
        icon: Headphones,
        title: 'Hỗ trợ seller hiệu quả',
        description: 'Người bán có thể quản lý sản phẩm, tồn kho, đơn hàng và doanh thu trong một hệ thống tập trung.',
    },
];

export default function BenefitsSection() {
    return (
        <section className="section-padding bg-brand-surface/30">
            <div className="max-w-container mx-auto px-4">
                <div className="text-center mb-12">
                    <h2 className="text-2xl md:text-3xl font-bold text-brand-text-primary mb-3">Vì sao nên chọn ChoTaiNguyen</h2>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    {benefits.map((b, i) => (
                        <div key={i} className="text-center group">
                            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-primary/15 to-brand-secondary/15 flex items-center justify-center mx-auto mb-4 group-hover:from-brand-primary/25 group-hover:to-brand-secondary/25 transition-all">
                                <b.icon className="w-7 h-7 text-brand-primary" />
                            </div>
                            <h3 className="text-base font-semibold text-brand-text-primary mb-2">{b.title}</h3>
                            <p className="text-sm text-brand-text-secondary leading-relaxed">{b.description}</p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
