'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import { Store, CheckCircle, FileText, User, Phone, CreditCard, Clock, ArrowRight, Shield, AlertTriangle, Building2 } from 'lucide-react';
import { VIETNAMESE_BANKS } from '@/lib/banks';

export default function SellerRegistrationPage() {
    const { user, updateUser } = useAuth();
    const router = useRouter();
    const [step, setStep] = useState(1);
    const [kycRequired, setKycRequired] = useState(false);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [existingApp, setExistingApp] = useState<any>(null);
    const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
    const [formData, setFormData] = useState({
        shopName: '',
        fullName: '',
        phone: '',
        cccd: '',
        address: '',
        bankName: '',
        bankAccount: '',
        bankOwner: '',
    });

    useEffect(() => {
        if (user) checkStatus();
    }, [user]);

    const checkStatus = async () => {
        try {
            const res = await fetch(`/api/v1/seller/register?userId=${user?.id}`);
            const data = await res.json();
            if (data.success) {
                setKycRequired(data.settings?.kycRequired || false);
                if (data.data) {
                    setExistingApp(data.data);
                }
            }
        } catch { }
        setLoading(false);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const res = await fetch('/api/v1/seller/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: user?.id,
                    username: user?.username,
                    userEmail: user?.email,
                    shopName: formData.shopName,
                    bankName: formData.bankName,
                    bankAccount: formData.bankAccount,
                    bankOwner: formData.bankOwner,
                    ...(kycRequired ? {
                        kycFullName: formData.fullName,
                        kycCccd: formData.cccd,
                        kycPhone: formData.phone,
                        kycAddress: formData.address,
                    } : {}),
                }),
            });
            const data = await res.json();
            setResult({ success: data.success, message: data.message });

            if (data.success && data.data?.status === 'APPROVED') {
                // Update user role in context to SELLER
                updateUser({ role: 'SELLER' });
                setTimeout(() => {
                    router.push('/seller');
                }, 2000);
            }
        } catch {
            setResult({ success: false, message: 'Lỗi kết nối. Vui lòng thử lại.' });
        }
        setSubmitting(false);
    };

    // Steps depend on KYC mode
    const steps = kycRequired
        ? ['Thông tin Shop', 'Xác minh KYC', 'Tài khoản ngân hàng']
        : ['Thông tin Shop', 'Tài khoản ngân hàng'];

    const totalSteps = steps.length;

    if (!user) {
        return (
            <>
                <Header />
                <main className="min-h-screen bg-brand-bg flex items-center justify-center">
                    <div className="card max-w-md text-center">
                        <Shield className="w-12 h-12 text-brand-primary mx-auto mb-4" />
                        <h2 className="text-xl font-bold text-brand-text-primary mb-2">Đăng nhập để tiếp tục</h2>
                        <p className="text-sm text-brand-text-muted mb-6">Bạn cần đăng nhập tài khoản trước khi đăng ký bán hàng.</p>
                        <button onClick={() => router.push('/dang-nhap')} className="btn-primary w-full">Đăng nhập ngay</button>
                    </div>
                </main>
                <Footer />
            </>
        );
    }

    if (loading) {
        return (
            <>
                <Header />
                <main className="min-h-screen bg-brand-bg flex items-center justify-center">
                    <div className="animate-spin w-8 h-8 border-2 border-brand-primary border-t-transparent rounded-full" />
                </main>
                <Footer />
            </>
        );
    }

    // Already has an application
    if (existingApp) {
        const statusInfo: Record<string, { icon: React.ReactNode; title: string; desc: string; color: string }> = {
            PENDING: { icon: <Clock className="w-8 h-8 text-brand-warning" />, title: 'Đơn đang chờ duyệt', desc: 'Admin sẽ duyệt hồ sơ trong 1-3 ngày. Bạn sẽ nhận thông báo khi có kết quả.', color: 'brand-warning' },
            APPROVED: { icon: <CheckCircle className="w-8 h-8 text-brand-success" />, title: 'Gian hàng đã được duyệt!', desc: `Shop "${existingApp.shopName}" đã hoạt động. Bạn có thể bắt đầu bán hàng.`, color: 'brand-success' },
            REJECTED: { icon: <AlertTriangle className="w-8 h-8 text-brand-danger" />, title: 'Đơn bị từ chối', desc: existingApp.rejectionReason || 'Đơn đăng ký của bạn đã bị từ chối. Vui lòng liên hệ admin.', color: 'brand-danger' },
            KYC_REQUIRED: { icon: <FileText className="w-8 h-8 text-brand-warning" />, title: 'Cần bổ sung KYC', desc: 'Admin đã bật yêu cầu KYC. Vui lòng cung cấp thêm giấy tờ xác minh.', color: 'brand-warning' },
        };
        const info = statusInfo[existingApp.status] || statusInfo.PENDING;

        return (
            <>
                <Header />
                <main className="min-h-screen bg-brand-bg flex items-center justify-center p-6">
                    <div className="card max-w-lg text-center space-y-5">
                        <div className={`w-16 h-16 rounded-full bg-${info.color}/15 flex items-center justify-center mx-auto`}>
                            {info.icon}
                        </div>
                        <h2 className="text-xl font-bold text-brand-text-primary">{info.title}</h2>
                        <p className="text-sm text-brand-text-muted">{info.desc}</p>
                        <div className="bg-brand-surface-2 rounded-xl p-4 text-left text-xs space-y-1">
                            <div className="flex justify-between"><span className="text-brand-text-muted">Tên shop:</span><span className="font-medium text-brand-text-primary">{existingApp.shopName}</span></div>
                            <div className="flex justify-between"><span className="text-brand-text-muted">Ngày đăng ký:</span><span className="font-medium text-brand-text-primary">{new Date(existingApp.createdAt).toLocaleDateString('vi-VN')}</span></div>
                            <div className="flex justify-between"><span className="text-brand-text-muted">Trạng thái:</span><span className={`font-semibold text-${info.color}`}>{existingApp.status === 'APPROVED' ? 'Đã duyệt' : existingApp.status === 'PENDING' ? 'Chờ duyệt' : existingApp.status === 'REJECTED' ? 'Từ chối' : 'Cần KYC'}</span></div>
                        </div>
                        <div className="flex gap-3">
                            <button onClick={() => router.push('/')} className="btn-secondary flex-1 text-sm">Về trang chủ</button>
                            {existingApp.status === 'APPROVED' && (
                                <button onClick={() => router.push('/seller')} className="btn-primary flex-1 text-sm">Vào Seller Center</button>
                            )}
                            {existingApp.status === 'REJECTED' && (
                                <button onClick={() => { setExistingApp(null); setStep(1); }} className="btn-primary flex-1 text-sm">Đăng ký lại</button>
                            )}
                        </div>
                    </div>
                </main>
                <Footer />
            </>
        );
    }

    // Result screen
    if (result) {
        return (
            <>
                <Header />
                <main className="min-h-screen bg-brand-bg flex items-center justify-center p-6">
                    <div className="card max-w-lg text-center space-y-5">
                        <div className={`w-16 h-16 rounded-full ${result.success ? 'bg-brand-success/15' : 'bg-brand-danger/15'} flex items-center justify-center mx-auto`}>
                            {result.success ? <CheckCircle className="w-8 h-8 text-brand-success" /> : <AlertTriangle className="w-8 h-8 text-brand-danger" />}
                        </div>
                        <h2 className="text-xl font-bold text-brand-text-primary">{result.success ? 'Thành công!' : 'Có lỗi'}</h2>
                        <p className="text-sm text-brand-text-muted">{result.message}</p>
                        <div className="flex gap-3">
                            <button onClick={() => router.push('/')} className="btn-secondary flex-1 text-sm">Về trang chủ</button>
                            {result.success && (
                                <button onClick={() => router.push('/seller')} className="btn-primary flex-1 text-sm">Vào Seller Center</button>
                            )}
                        </div>
                    </div>
                </main>
                <Footer />
            </>
        );
    }

    return (
        <>
            <Header />
            <main className="min-h-screen bg-brand-bg">
                {/* Hero */}
                <section className="relative py-12 overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-brand-primary/10 to-brand-secondary/5" />
                    <div className="max-w-3xl mx-auto px-6 relative z-10 text-center">
                        <div className="badge-primary mb-3 inline-flex">Đăng ký Seller</div>
                        <h1 className="text-2xl md:text-3xl font-bold text-brand-text-primary mb-3">
                            Bán hàng trên <span className="gradient-text">ChoTaiNguyen</span>
                        </h1>
                        <p className="text-sm text-brand-text-secondary max-w-xl mx-auto">
                            {kycRequired
                                ? `Đăng ký gian hàng với tài khoản @${user.username}. Hoàn tất xác minh KYC để mở shop.`
                                : `Chỉ cần tạo tên shop và thêm tài khoản ngân hàng — đơn giản, nhanh chóng!`
                            }
                        </p>
                        {!kycRequired && (
                            <div className="mt-3 inline-flex items-center gap-2 bg-brand-success/10 text-brand-success text-xs font-medium px-3 py-1.5 rounded-full">
                                <CheckCircle className="w-3.5 h-3.5" /> Không yêu cầu KYC — Tạo shop chỉ trong 1 phút
                            </div>
                        )}
                    </div>
                </section>

                {/* Steps Progress */}
                <div className="max-w-3xl mx-auto px-6 mb-8">
                    <div className="flex items-center justify-center gap-3">
                        {steps.map((label, i) => (
                            <div key={i} className="flex items-center gap-2">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${step > i + 1 ? 'bg-brand-success text-white' : step === i + 1 ? 'bg-brand-primary text-white' : 'bg-brand-surface-2 text-brand-text-muted'}`}>
                                    {step > i + 1 ? <CheckCircle className="w-4 h-4" /> : i + 1}
                                </div>
                                <span className={`text-xs font-medium hidden sm:block ${step === i + 1 ? 'text-brand-primary' : 'text-brand-text-muted'}`}>{label}</span>
                                {i < totalSteps - 1 && <div className={`w-12 h-0.5 ${step > i + 1 ? 'bg-brand-success' : 'bg-brand-border'}`} />}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Form */}
                <div className="max-w-2xl mx-auto px-6 pb-16">
                    <form onSubmit={handleSubmit}>
                        {/* Step 1: Shop Info */}
                        {step === 1 && (
                            <div className="card space-y-5">
                                <div className="flex items-center gap-3 mb-2">
                                    <Store className="w-5 h-5 text-brand-primary" />
                                    <h2 className="text-lg font-semibold text-brand-text-primary">Thông tin Shop</h2>
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-brand-text-secondary mb-1.5 block">Tên Shop *</label>
                                    <input type="text" value={formData.shopName} onChange={e => setFormData({ ...formData, shopName: e.target.value })} placeholder="VD: DigitalVN Store" className="input-field w-full" required />
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-brand-text-secondary mb-1.5 block">Tài khoản liên kết</label>
                                    <div className="bg-brand-surface-2 rounded-xl p-3 flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-brand-primary/20 flex items-center justify-center"><User className="w-4 h-4 text-brand-primary" /></div>
                                        <div>
                                            <div className="text-sm font-medium text-brand-text-primary">{user.fullName}</div>
                                            <div className="text-xs text-brand-text-muted">@{user.username} · {user.email}</div>
                                        </div>
                                    </div>
                                </div>
                                <button type="button" onClick={() => setStep(kycRequired ? 2 : 2)} disabled={!formData.shopName} className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50">
                                    Tiếp theo <ArrowRight className="w-4 h-4" />
                                </button>
                            </div>
                        )}

                        {/* Step 2: KYC (only when kycRequired) */}
                        {step === 2 && kycRequired && (
                            <div className="card space-y-5">
                                <div className="flex items-center gap-3 mb-2">
                                    <FileText className="w-5 h-5 text-brand-primary" />
                                    <h2 className="text-lg font-semibold text-brand-text-primary">Xác minh danh tính (KYC)</h2>
                                </div>
                                <div className="bg-brand-warning/10 border border-brand-warning/30 rounded-xl p-3 text-xs text-brand-text-secondary flex items-start gap-2">
                                    <AlertTriangle className="w-4 h-4 text-brand-warning shrink-0 mt-0.5" />
                                    Thông tin KYC sẽ được bảo mật và chỉ dùng để xác minh danh tính. Admin sẽ duyệt trong 1-3 ngày.
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-brand-text-secondary mb-1.5 block">Họ và tên (theo CCCD) *</label>
                                    <input type="text" value={formData.fullName} onChange={e => setFormData({ ...formData, fullName: e.target.value })} placeholder="Nguyễn Văn A" className="input-field w-full" required />
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-brand-text-secondary mb-1.5 block">Số CCCD/CMND *</label>
                                    <div className="relative">
                                        <CreditCard className="w-4 h-4 text-brand-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
                                        <input type="text" value={formData.cccd} onChange={e => setFormData({ ...formData, cccd: e.target.value })} placeholder="01234567890" className="input-field w-full !pl-10" required />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-brand-text-secondary mb-1.5 block">Số điện thoại *</label>
                                    <div className="relative">
                                        <Phone className="w-4 h-4 text-brand-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
                                        <input type="tel" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} placeholder="0912345678" className="input-field w-full !pl-10" required />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-brand-text-secondary mb-1.5 block">Địa chỉ</label>
                                    <input type="text" value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} placeholder="Số nhà, đường, phường/xã, quận/huyện, tỉnh/TP" className="input-field w-full" />
                                </div>
                                <div className="flex gap-3">
                                    <button type="button" onClick={() => setStep(1)} className="btn-secondary flex-1 text-sm">Quay lại</button>
                                    <button type="button" onClick={() => setStep(3)} disabled={!formData.fullName || !formData.cccd || !formData.phone} className="btn-primary flex-1 flex items-center justify-center gap-2 text-sm disabled:opacity-50">
                                        Tiếp theo <ArrowRight className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Step 2 (no KYC) or Step 3 (with KYC): Bank Account */}
                        {((step === 2 && !kycRequired) || (step === 3 && kycRequired)) && (
                            <div className="card space-y-5">
                                <div className="flex items-center gap-3 mb-2">
                                    <Building2 className="w-5 h-5 text-brand-primary" />
                                    <h2 className="text-lg font-semibold text-brand-text-primary">Tài khoản ngân hàng</h2>
                                </div>
                                <p className="text-xs text-brand-text-muted">Dùng để nhận tiền khi bạn rút tiền từ ví seller. Mốc rút tối thiểu: <span className="font-semibold text-brand-warning">500.000đ</span></p>
                                <div>
                                    <label className="text-sm font-medium text-brand-text-secondary mb-1.5 block">Tên ngân hàng *</label>
                                    <select value={formData.bankName} onChange={e => setFormData({ ...formData, bankName: e.target.value })} className="input-field w-full" required>
                                        <option value="">Chọn ngân hàng</option>
                                        {VIETNAMESE_BANKS.map(b => (
                                            <option key={b.code} value={b.code}>{b.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-brand-text-secondary mb-1.5 block">Số tài khoản *</label>
                                    <input type="text" value={formData.bankAccount} onChange={e => setFormData({ ...formData, bankAccount: e.target.value })} placeholder="0123456789" className="input-field w-full" required />
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-brand-text-secondary mb-1.5 block">Tên chủ tài khoản *</label>
                                    <input type="text" value={formData.bankOwner} onChange={e => setFormData({ ...formData, bankOwner: e.target.value })} placeholder="NGUYEN VAN A" className="input-field w-full uppercase" required />
                                </div>
                                <div className="flex gap-3">
                                    <button type="button" onClick={() => setStep(kycRequired ? 2 : 1)} className="btn-secondary flex-1 text-sm">Quay lại</button>
                                    <button type="submit" disabled={submitting || !formData.bankName || !formData.bankAccount || !formData.bankOwner} className="btn-primary flex-1 flex items-center justify-center gap-2 text-sm disabled:opacity-50">
                                        {submitting ? (
                                            <><div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" /> Đang gửi...</>
                                        ) : (
                                            <><CheckCircle className="w-4 h-4" /> Gửi đăng ký</>
                                        )}
                                    </button>
                                </div>
                            </div>
                        )}
                    </form>
                </div>
            </main>
            <Footer />
        </>
    );
}
