import { Wallet, Search, Package } from 'lucide-react';

const steps = [
    {
        icon: Wallet,
        step: '01',
        title: 'Nạp tiền vào ví',
        description: 'Nạp tiền vào hệ thống để sẵn sàng giao dịch nhanh hơn và quản lý chi tiêu thuận tiện hơn.',
    },
    {
        icon: Search,
        step: '02',
        title: 'Chọn sản phẩm phù hợp',
        description: 'Tìm kiếm, lọc và so sánh sản phẩm từ nhiều gian hàng theo nhu cầu của bạn.',
    },
    {
        icon: Package,
        step: '03',
        title: 'Nhận hàng và theo dõi đơn',
        description: 'Hoàn tất thanh toán, nhận thông tin giao hàng và theo dõi trạng thái đơn ngay trên hệ thống.',
    },
];

export default function StepsSection() {
    return (
        <section className="section-padding">
            <div className="max-w-container mx-auto px-4">
                <div className="text-center mb-12">
                    <h2 className="text-2xl md:text-3xl font-bold text-brand-text-primary mb-3">Bắt đầu chỉ với 3 bước</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
                    {/* Connecting Line */}
                    <div className="hidden md:block absolute top-14 left-[20%] right-[20%] h-px bg-gradient-to-r from-brand-primary/30 via-brand-secondary/30 to-brand-primary/30" />

                    {steps.map((s, i) => (
                        <div key={i} className="text-center relative">
                            <div className="relative inline-block mb-5">
                                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-primary to-brand-secondary flex items-center justify-center mx-auto shadow-glow-primary">
                                    <s.icon className="w-7 h-7 text-white" />
                                </div>
                                <div className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-brand-bg border-2 border-brand-primary text-brand-primary text-xs font-bold flex items-center justify-center">
                                    {s.step}
                                </div>
                            </div>
                            <h3 className="text-base font-semibold text-brand-text-primary mb-2">{s.title}</h3>
                            <p className="text-sm text-brand-text-secondary leading-relaxed max-w-xs mx-auto">{s.description}</p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
