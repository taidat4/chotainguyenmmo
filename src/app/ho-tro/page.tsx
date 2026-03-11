import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import { Mail, Phone, MessageSquare, Clock, HelpCircle, ChevronDown } from 'lucide-react';

const faqs = [
    { q: 'Sản phẩm được giao như thế nào?', a: 'Sau khi thanh toán, sản phẩm số được giao tự động qua hệ thống. Bạn có thể xem thông tin sản phẩm trong mục Đơn hàng.' },
    { q: 'Tôi có thể hoàn tiền không?', a: 'Có. Nếu sản phẩm không đúng mô tả hoặc không hoạt động, bạn có thể tạo khiếu nại trong vòng 24-48 giờ để được hoàn tiền.' },
    { q: 'Nạp tiền mất bao lâu?', a: 'MoMo và VNPay: ngay lập tức. Chuyển khoản ngân hàng: 1-5 phút (giờ hành chính) hoặc tối đa 24 giờ.' },
    { q: 'Làm sao để trở thành seller?', a: 'Đăng ký tài khoản → Vào trang "Đăng ký bán hàng" → Điền thông tin shop → Chờ admin duyệt (1-2 ngày).' },
    { q: 'Phí giao dịch trên sàn là bao nhiêu?', a: 'Người mua: 0% phí (không mất phí khi mua hàng). Người bán (Seller): Sàn thu phí trên doanh thu mỗi đơn hàng thành công (mặc định 5%, admin có thể điều chỉnh). Phí rút tiền: 15.000đ/lần (cố định, chỉ thu seller).' },
    { q: 'Tài khoản bị khóa thì sao?', a: 'Liên hệ support qua email hoặc hotline để được hỗ trợ giải quyết. Cung cấp thông tin tài khoản khi liên hệ.' },
];

export default function SupportPage() {
    return (
        <>
            <Header />
            <main className="min-h-screen bg-brand-bg py-12">
                <div className="max-w-4xl mx-auto px-6">
                    <div className="text-center mb-12">
                        <h1 className="text-3xl font-bold text-brand-text-primary mb-2">Trung tâm hỗ trợ</h1>
                        <p className="text-brand-text-secondary">Chúng tôi luôn sẵn sàng hỗ trợ bạn. Liên hệ qua các kênh bên dưới.</p>
                    </div>

                    {/* Contact Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-12">
                        {[
                            { icon: Mail, title: 'Email', value: 'support@chotainguyen.vn', desc: 'Phản hồi trong 24 giờ' },
                            { icon: Phone, title: 'Hotline', value: '1900 6868', desc: 'Thứ 2-7, 8:00-22:00' },
                            { icon: MessageSquare, title: 'Live Chat', value: 'Chat trực tuyến', desc: 'Hỗ trợ ngay lập tức' },
                        ].map((c, i) => (
                            <div key={i} className="card-hover text-center">
                                <div className="w-14 h-14 rounded-2xl bg-brand-primary/10 flex items-center justify-center mx-auto mb-4">
                                    <c.icon className="w-7 h-7 text-brand-primary" />
                                </div>
                                <h3 className="text-base font-semibold text-brand-text-primary">{c.title}</h3>
                                <p className="text-sm text-brand-primary font-medium mt-1">{c.value}</p>
                                <p className="text-xs text-brand-text-muted mt-1">{c.desc}</p>
                            </div>
                        ))}
                    </div>

                    {/* FAQ */}
                    <div>
                        <div className="flex items-center gap-2 mb-6">
                            <HelpCircle className="w-5 h-5 text-brand-primary" />
                            <h2 className="text-xl font-bold text-brand-text-primary">Câu hỏi thường gặp</h2>
                        </div>
                        <div className="space-y-3">
                            {faqs.map((faq, i) => (
                                <details key={i} className="card group cursor-pointer">
                                    <summary className="flex items-center justify-between text-sm font-semibold text-brand-text-primary list-none">
                                        {faq.q}
                                        <ChevronDown className="w-4 h-4 text-brand-text-muted group-open:rotate-180 transition-transform shrink-0" />
                                    </summary>
                                    <p className="text-sm text-brand-text-secondary mt-3 pt-3 border-t border-brand-border/50">{faq.a}</p>
                                </details>
                            ))}
                        </div>
                    </div>

                    {/* Working Hours */}
                    <div className="card mt-8 bg-brand-surface-2/30 border-dashed">
                        <div className="flex items-start gap-3">
                            <Clock className="w-5 h-5 text-brand-primary shrink-0 mt-0.5" />
                            <div>
                                <h3 className="text-sm font-semibold text-brand-text-primary mb-1">Giờ làm việc</h3>
                                <p className="text-xs text-brand-text-secondary">Thứ 2 - Thứ 7: 08:00 - 22:00 (GMT+7). Chủ nhật & lễ: 09:00 - 18:00.</p>
                                <p className="text-xs text-brand-text-muted mt-1">Hệ thống giao dịch tự động hoạt động 24/7.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
            <Footer />
        </>
    );
}
