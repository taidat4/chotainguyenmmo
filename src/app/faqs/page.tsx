'use client';

import { useState } from 'react';
import { ChevronDown, HelpCircle, CreditCard, ShoppingBag, Shield, Store, Search } from 'lucide-react';

const faqCategories = [
    {
        id: 'account',
        icon: HelpCircle,
        title: 'Tài khoản',
        color: 'text-brand-primary',
        bg: 'bg-brand-primary/10',
        questions: [
            {
                q: 'Làm sao để đăng ký tài khoản?',
                a: 'Bạn có thể đăng ký tài khoản bằng cách nhấn nút "Đăng ký" ở góc trên bên phải, điền đầy đủ thông tin cá nhân gồm: Họ tên, Email, Tên đăng nhập, Mật khẩu. Sau khi đăng ký thành công, bạn có thể đăng nhập ngay lập tức.'
            },
            {
                q: 'Quên mật khẩu thì phải làm sao?',
                a: 'Nhấn vào "Quên mật khẩu" tại trang đăng nhập, nhập email đã đăng ký. Hệ thống sẽ gửi link đặt lại mật khẩu tới email của bạn. Link có hiệu lực trong 30 phút.'
            },
            {
                q: 'Tôi có thể đổi tên đăng nhập không?',
                a: 'Tên đăng nhập (username) không thể thay đổi sau khi đã đăng ký. Tuy nhiên bạn có thể cập nhật Họ tên hiển thị, Email, Số điện thoại tại mục Hồ sơ trong Dashboard.'
            },
            {
                q: 'Làm sao để bật bảo mật 2 lớp (2FA)?',
                a: 'Vào Dashboard → Bảo mật → Bật xác thực 2 bước. Bạn sẽ cần tải ứng dụng Google Authenticator hoặc Authy để quét mã QR và lấy mã OTP mỗi lần đăng nhập.'
            },
        ],
    },
    {
        id: 'payment',
        icon: CreditCard,
        title: 'Thanh toán & Nạp tiền',
        color: 'text-brand-success',
        bg: 'bg-brand-success/10',
        questions: [
            {
                q: 'Hỗ trợ những phương thức nạp tiền nào?',
                a: 'Hiện tại ChoTaiNguyen hỗ trợ nạp tiền qua chuyển khoản ngân hàng MB Bank. Hệ thống sẽ tự động phát hiện và cộng tiền vào ví trong vòng 1-5 phút sau khi chuyển khoản thành công.'
            },
            {
                q: 'Nạp tiền bao lâu thì được cộng?',
                a: 'Hệ thống kiểm tra giao dịch ngân hàng tự động. Thông thường tiền sẽ được cộng trong vòng 1-5 phút. Nếu sau 10 phút chưa thấy, hãy nhấn "Kiểm tra lại" hoặc liên hệ hỗ trợ.'
            },
            {
                q: 'Số tiền nạp tối thiểu và tối đa là bao nhiêu?',
                a: 'Số tiền nạp tối thiểu là 10.000đ và tối đa là 50.000.000đ mỗi lần. Không giới hạn số lần nạp trong ngày.'
            },
            {
                q: 'Tôi có thể rút tiền từ ví không?',
                a: 'Có, bạn có thể yêu cầu rút tiền về tài khoản ngân hàng. Vào Dashboard → Ví → Rút tiền, nhập số tiền và thông tin ngân hàng. Yêu cầu rút tiền sẽ được xử lý trong 1-3 ngày làm việc.'
            },
        ],
    },
    {
        id: 'order',
        icon: ShoppingBag,
        title: 'Đơn hàng & Giao hàng',
        color: 'text-brand-info',
        bg: 'bg-brand-info/10',
        questions: [
            {
                q: 'Sau khi mua hàng, sản phẩm được giao như thế nào?',
                a: 'ChoTaiNguyen là sàn thương mại điện tử tài khoản số. Sản phẩm sẽ được giao tự động (hiển thị trực tiếp trên trang đơn hàng) hoặc giao thủ công bởi người bán trong vòng vài giờ tùy loại sản phẩm.'
            },
            {
                q: 'Bấm vào đâu để xem sản phẩm đã mua?',
                a: 'Vào Dashboard → Đơn hàng → Nhấn vào mã đơn hàng để xem chi tiết sản phẩm đã mua. Bạn có thể copy thông tin sản phẩm (tài khoản, key, v.v.) từ đó.'
            },
            {
                q: 'Tôi có thể hủy đơn hàng không?',
                a: 'Đơn hàng đã thanh toán và giao tự động thì không thể hủy. Với đơn hàng giao thủ công chưa được xử lý, bạn có thể liên hệ seller để hủy. Tiền sẽ được hoàn vào ví nếu seller đồng ý hủy.'
            },
            {
                q: 'Mọi giao dịch trên trang có được giữ tiền trung gian không?',
                a: 'Có. Mọi giao dịch đều được giữ tiền 3 ngày, thay thế cho hình thức trung gian, các bạn yên tâm giao dịch nhé. Nếu có vấn đề, hãy tạo khiếu nại trong thời gian bảo hành.'
            },
        ],
    },
    {
        id: 'warranty',
        icon: Shield,
        title: 'Bảo hành & Khiếu nại',
        color: 'text-brand-warning',
        bg: 'bg-brand-warning/10',
        questions: [
            {
                q: 'Chính sách bảo hành như thế nào?',
                a: 'Mỗi sản phẩm có thời gian bảo hành riêng do seller quy định (ví dụ: 3 ngày, 7 ngày, 30 ngày). Thời gian bảo hành được hiển thị rõ trên trang sản phẩm và đơn hàng.'
            },
            {
                q: 'Làm sao để tạo khiếu nại?',
                a: 'Vào Dashboard → Đơn hàng → Nhấn nút "Khiếu nại" bên cạnh đơn hàng cần khiếu nại. Mô tả chi tiết vấn đề gặp phải và đợi seller phản hồi. Nếu seller không phản hồi trong 48h, admin sẽ can thiệp.'
            },
            {
                q: 'Nếu seller không giải quyết thì sao?',
                a: 'Trong trường hợp chủ shop không giải quyết hoặc không thỏa đáng, hãy bấm vào "Khiếu nại đơn hàng", để bên chúng tôi giữ tiền đơn hàng đó (lâu hơn 3 ngày) trong lúc bạn đợi phản hồi từ người bán. Bạn hoàn toàn có thể Hủy khiếu nại sau đó.'
            },
            {
                q: 'Bên mình chỉ giữ tiền bao lâu?',
                a: 'Bên mình chỉ giữ tiền 3 ngày, trong trường hợp đơn hàng không có khiếu nại gì, tiền sẽ được chuyển cho người bán. Vì vậy xin hãy KIỂM TRA KỸ SẢN PHẨM sau khi mua.'
            },
        ],
    },
    {
        id: 'seller',
        icon: Store,
        title: 'Người bán (Seller)',
        color: 'text-brand-secondary',
        bg: 'bg-brand-secondary/10',
        questions: [
            {
                q: 'Làm sao để trở thành seller?',
                a: 'Nhấn "Đăng ký bán hàng" trên menu hoặc vào Seller Center. Điền đầy đủ thông tin cửa hàng, chờ admin duyệt. Quá trình duyệt thường mất 1-24 giờ.'
            },
            {
                q: 'Phí bán hàng trên ChoTaiNguyen là bao nhiêu?',
                a: 'ChoTaiNguyen thu phí hoa hồng cho mỗi đơn hàng thành công. Mức phí cụ thể sẽ được thông báo khi bạn đăng ký seller và có thể thay đổi theo từng thời kỳ.'
            },
            {
                q: 'Sản phẩm của tôi có thể giao tự động không?',
                a: 'Có! Khi thêm sản phẩm, chọn "Giao tự động" và upload danh sách tài khoản/key vào kho hàng. Hệ thống sẽ tự động giao cho khách ngay sau khi thanh toán thành công.'
            },
            {
                q: 'Làm sao để rút tiền bán hàng?',
                a: 'Tiền từ đơn hàng hoàn tất sẽ tự động cộng vào ví sau thời gian giữ tiền (3 ngày). Bạn có thể rút tiền từ ví về tài khoản ngân hàng bất cứ lúc nào.'
            },
        ],
    },
];

export default function FAQsPage() {
    const [openItems, setOpenItems] = useState<Record<string, boolean>>({});
    const [searchQuery, setSearchQuery] = useState('');

    const toggleItem = (key: string) => {
        setOpenItems(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const filteredCategories = faqCategories.map(cat => ({
        ...cat,
        questions: cat.questions.filter(q =>
            !searchQuery ||
            q.q.toLowerCase().includes(searchQuery.toLowerCase()) ||
            q.a.toLowerCase().includes(searchQuery.toLowerCase())
        ),
    })).filter(cat => cat.questions.length > 0);

    return (
        <div className="max-w-container mx-auto px-4 py-12">
            {/* Header */}
            <div className="text-center mb-10">
                <h1 className="text-3xl font-bold text-brand-text-primary mb-3">Câu hỏi thường gặp</h1>
                <p className="text-brand-text-muted max-w-xl mx-auto">
                    Tìm câu trả lời nhanh cho các thắc mắc về tài khoản, thanh toán, đơn hàng, bảo hành và bán hàng trên ChoTaiNguyen.
                </p>
            </div>

            {/* Search */}
            <div className="max-w-xl mx-auto mb-10 relative">
                <Search className="w-5 h-5 text-brand-text-muted absolute left-4 top-1/2 -translate-y-1/2" />
                <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Tìm kiếm câu hỏi..."
                    className="input-field !py-3.5 !pl-12 text-base"
                />
            </div>

            {/* FAQ Categories */}
            <div className="space-y-8 max-w-3xl mx-auto">
                {filteredCategories.map((cat) => (
                    <div key={cat.id} className="card">
                        <div className="flex items-center gap-3 mb-5">
                            <div className={`w-10 h-10 rounded-xl ${cat.bg} flex items-center justify-center`}>
                                <cat.icon className={`w-5 h-5 ${cat.color}`} />
                            </div>
                            <h2 className="text-lg font-bold text-brand-text-primary">{cat.title}</h2>
                        </div>

                        <div className="space-y-1">
                            {cat.questions.map((item, idx) => {
                                const key = `${cat.id}-${idx}`;
                                const isOpen = openItems[key];
                                return (
                                    <div key={idx} className="border border-brand-border/50 rounded-xl overflow-hidden">
                                        <button
                                            onClick={() => toggleItem(key)}
                                            className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-brand-surface-2/50 transition-colors"
                                        >
                                            <span className="text-sm font-medium text-brand-text-primary pr-4">{item.q}</span>
                                            <ChevronDown className={`w-4 h-4 text-brand-text-muted shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                                        </button>
                                        {isOpen && (
                                            <div className="px-5 pb-4 text-sm text-brand-text-secondary leading-relaxed border-t border-brand-border/30 pt-3 bg-brand-surface-2/30">
                                                {item.a}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}

                {filteredCategories.length === 0 && (
                    <div className="text-center py-16">
                        <HelpCircle className="w-12 h-12 text-brand-text-muted/30 mx-auto mb-3" />
                        <p className="text-brand-text-muted">Không tìm thấy câu hỏi phù hợp.</p>
                    </div>
                )}
            </div>

            {/* Contact CTA */}
            <div className="text-center mt-12 py-8 bg-brand-surface border border-brand-border rounded-2xl max-w-3xl mx-auto">
                <h3 className="text-base font-semibold text-brand-text-primary mb-2">Không tìm thấy câu trả lời?</h3>
                <p className="text-sm text-brand-text-muted mb-4">Liên hệ đội ngũ hỗ trợ — chúng tôi sẵn sàng giúp bạn.</p>
                <a href="/ho-tro" className="btn-primary !px-6 !py-2.5 text-sm inline-flex items-center gap-2">
                    <HelpCircle className="w-4 h-4" /> Liên hệ hỗ trợ
                </a>
            </div>
        </div>
    );
}
