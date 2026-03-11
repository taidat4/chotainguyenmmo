import { Star, Quote } from 'lucide-react';

const testimonials = [
    {
        name: 'Minh Tuấn',
        role: 'Người mua',
        avatar: 'MT',
        rating: 5,
        content: 'Giao diện dễ dùng, lọc sản phẩm nhanh và phần quản lý đơn hàng khá rõ ràng. Mọi thứ tập trung một chỗ nên thao tác tiện hơn hẳn.',
    },
    {
        name: 'Hoàng Lan',
        role: 'Người bán',
        avatar: 'HL',
        rating: 5,
        content: 'Seller dashboard trực quan, đăng sản phẩm và theo dõi doanh thu khá ổn. Phần tồn kho tự động giúp tiết kiệm nhiều thời gian.',
    },
    {
        name: 'Thành Đạt',
        role: 'Người mua',
        avatar: 'TĐ',
        rating: 5,
        content: 'Điểm mình thích là lịch sử giao dịch và ví hiển thị rõ, dễ kiểm tra, đỡ bị rối khi xử lý nhiều đơn.',
    },
];

export default function TestimonialsSection() {
    return (
        <section className="section-padding bg-brand-surface/30">
            <div className="max-w-container mx-auto px-4">
                <div className="text-center mb-12">
                    <h2 className="text-2xl md:text-3xl font-bold text-brand-text-primary mb-3">Người dùng nói gì về ChoTaiNguyen</h2>
                    <p className="text-brand-text-secondary">
                        Trải nghiệm thực tế từ người dùng và người bán đang hoạt động trên nền tảng.
                    </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {testimonials.map((t, i) => (
                        <div key={i} className="bg-brand-surface border border-brand-border rounded-2xl p-6 relative">
                            <Quote className="w-8 h-8 text-brand-primary/20 absolute top-4 right-4" />
                            <div className="flex items-center gap-1.5 mb-4">
                                {[...Array(t.rating)].map((_, j) => (
                                    <Star key={j} className="w-4 h-4 text-brand-warning fill-brand-warning" />
                                ))}
                            </div>
                            <p className="text-sm text-brand-text-secondary leading-relaxed mb-6">
                                &ldquo;{t.content}&rdquo;
                            </p>
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand-primary to-brand-secondary flex items-center justify-center">
                                    <span className="text-white text-sm font-semibold">{t.avatar}</span>
                                </div>
                                <div>
                                    <div className="text-sm font-semibold text-brand-text-primary">{t.name}</div>
                                    <div className="text-xs text-brand-text-muted">{t.role}</div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
