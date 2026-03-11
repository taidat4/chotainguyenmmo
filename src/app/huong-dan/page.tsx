import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import { Search, ShoppingBag, Wallet, CreditCard, Package, AlertTriangle, Star, ArrowRight } from 'lucide-react';

const steps = [
    {
        icon: Search, title: 'Tìm sản phẩm', items: [
            'Duyệt danh mục hoặc dùng thanh tìm kiếm.',
            'Lọc theo giá, đánh giá, trạng thái tồn kho.',
            'Kiểm tra thông tin shop và số lượng đã bán.',
        ]
    },
    {
        icon: Wallet, title: 'Nạp tiền vào ví', items: [
            'Vào Dashboard → Ví → Nạp tiền.',
            'Hỗ trợ: MoMo, VNPay, chuyển khoản ngân hàng.',
            'Tiền vào ví ngay lập tức (hoặc 1-5 phút với bank transfer).',
        ]
    },
    {
        icon: ShoppingBag, title: 'Mua hàng', items: [
            'Nhấn "Mua ngay" trên trang sản phẩm.',
            'Xác nhận thanh toán từ ví nội bộ.',
            'Sản phẩm được giao tự động ngay lập tức.',
        ]
    },
    {
        icon: Package, title: 'Nhận sản phẩm', items: [
            'Vào Dashboard → Đơn hàng để xem thông tin sản phẩm.',
            'Kiểm tra sản phẩm ngay sau khi nhận.',
            'Thời gian khiếu nại: 24-48 giờ tùy sản phẩm.',
        ]
    },
    {
        icon: AlertTriangle, title: 'Khiếu nại (nếu cần)', items: [
            'Vào Dashboard → Khiếu nại → Tạo khiếu nại mới.',
            'Cung cấp ảnh chụp màn hình và mô tả chi tiết.',
            'Hệ thống xem xét và phản hồi trong 24-48 giờ.',
        ]
    },
    {
        icon: Star, title: 'Đánh giá', items: [
            'Đánh giá sản phẩm sau khi hoàn tất giao dịch.',
            'Giúp cộng đồng lựa chọn sản phẩm tốt hơn.',
        ]
    },
];

export default function GuidePage() {
    return (
        <>
            <Header />
            <main className="min-h-screen bg-brand-bg py-12">
                <div className="max-w-4xl mx-auto px-6">
                    <h1 className="text-3xl font-bold text-brand-text-primary mb-2">Hướng dẫn sử dụng</h1>
                    <p className="text-brand-text-secondary mb-10">Hướng dẫn chi tiết cách mua hàng, nạp tiền, khiếu nại trên ChoTaiNguyen.</p>

                    <div className="space-y-6">
                        {steps.map((step, i) => (
                            <div key={i} className="card">
                                <div className="flex items-center gap-4 mb-4">
                                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-primary to-brand-secondary flex items-center justify-center shrink-0">
                                        <span className="text-white font-bold">{i + 1}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <step.icon className="w-5 h-5 text-brand-primary" />
                                        <h2 className="text-lg font-semibold text-brand-text-primary">{step.title}</h2>
                                    </div>
                                </div>
                                <ul className="space-y-2 ml-14">
                                    {step.items.map((item, j) => (
                                        <li key={j} className="flex items-start gap-2 text-sm text-brand-text-secondary">
                                            <ArrowRight className="w-3 h-3 text-brand-primary mt-1 shrink-0" />
                                            {item}
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
