import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import { Shield, FileText, CreditCard, AlertTriangle } from 'lucide-react';

const policies = [
    {
        icon: FileText,
        title: 'Điều khoản sử dụng',
        sections: [
            'ChoTaiNguyen là nền tảng marketplace tài nguyên số, đóng vai trò trung gian giữa người mua và người bán.',
            'Người dùng phải đủ 18 tuổi hoặc có sự đồng ý của người giám hộ để sử dụng dịch vụ.',
            'Mọi giao dịch được thực hiện thông qua ví nội bộ của hệ thống.',
            'Nghiêm cấm mua bán sản phẩm vi phạm pháp luật, bản quyền hoặc nội dung không phù hợp.',
            'ChoTaiNguyen có quyền khóa tài khoản vi phạm điều khoản mà không cần thông báo trước.',
        ]
    },
    {
        icon: Shield,
        title: 'Chính sách bảo mật',
        sections: [
            'Chúng tôi thu thập thông tin cần thiết để vận hành dịch vụ: email, tên, số điện thoại.',
            'Thông tin cá nhân không được chia sẻ với bên thứ ba trừ khi có yêu cầu pháp lý.',
            'Dữ liệu giao dịch được mã hóa và lưu trữ an toàn trên hệ thống.',
            'Người dùng có quyền yêu cầu xóa dữ liệu cá nhân bất cứ lúc nào.',
        ]
    },
    {
        icon: CreditCard,
        title: 'Chính sách hoàn tiền',
        sections: [
            'Người mua có thể đặt khiếu nại trong vòng 24-48 giờ sau khi nhận sản phẩm.',
            'Nếu sản phẩm không đúng mô tả hoặc không hoạt động, người mua sẽ được hoàn tiền 100%.',
            'Tiền hoàn trả về ví nội bộ trong vòng 1-3 ngày làm việc sau khi khiếu nại được chấp nhận.',
            'Không hoàn tiền cho các sản phẩm đã sử dụng khiến không thể kiểm tra lại.',
        ]
    },
    {
        icon: AlertTriangle,
        title: 'Chính sách người bán',
        sections: [
            'Người bán chịu trách nhiệm hoàn toàn về chất lượng và tính hợp pháp của sản phẩm.',
            'Phí sàn chỉ thu trên doanh thu đơn hàng của Seller, không thu từ người mua.',
            'Mức phí sàn mặc định là 5% (admin có thể điều chỉnh tùy theo từng thời điểm).',
            'Phí rút tiền cố định 15.000đ/lần rút (chỉ áp dụng cho Seller).',
            'Rút tiền tối thiểu 500.000đ, xử lý trong 1-3 ngày làm việc.',
            'Shop có tỷ lệ khiếu nại quá cao có thể bị hạn chế hoặc khóa.',
        ]
    },
];

export default function PoliciesPage() {
    return (
        <>
            <Header />
            <main className="min-h-screen bg-brand-bg py-12">
                <div className="max-w-4xl mx-auto px-6">
                    <h1 className="text-3xl font-bold text-brand-text-primary mb-2">Chính sách & Điều khoản</h1>
                    <p className="text-brand-text-secondary mb-10">Cập nhật lần cuối: 01/03/2026</p>

                    <div className="space-y-8">
                        {policies.map((p, i) => (
                            <div key={i} className="card">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="w-10 h-10 rounded-xl bg-brand-primary/10 flex items-center justify-center">
                                        <p.icon className="w-5 h-5 text-brand-primary" />
                                    </div>
                                    <h2 className="text-lg font-semibold text-brand-text-primary">{p.title}</h2>
                                </div>
                                <ul className="space-y-3">
                                    {p.sections.map((s, j) => (
                                        <li key={j} className="flex items-start gap-3 text-sm text-brand-text-secondary">
                                            <span className="text-brand-primary mt-1 shrink-0">•</span>
                                            {s}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                    </div>
                </div>
            </main>
            <Footer />
        </>
    );
}
