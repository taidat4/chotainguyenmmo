import Link from 'next/link';
import { Mail, ArrowRight, ArrowLeft, KeyRound } from 'lucide-react';

export default function ForgotPasswordPage() {
    return (
        <div className="min-h-screen bg-brand-bg flex items-center justify-center p-6">
            <div className="w-full max-w-md">
                <div className="text-center mb-8">
                    <Link href="/" className="inline-flex items-center gap-2 mb-6">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-primary to-brand-secondary flex items-center justify-center">
                            <span className="text-white font-bold text-lg">CT</span>
                        </div>
                        <span className="text-xl font-bold text-brand-text-primary">ChoTaiNguyen</span>
                    </Link>
                    <div className="w-16 h-16 rounded-2xl bg-brand-primary/10 flex items-center justify-center mx-auto mb-4">
                        <KeyRound className="w-8 h-8 text-brand-primary" />
                    </div>
                    <h1 className="text-2xl font-bold text-brand-text-primary mb-2">Quên mật khẩu?</h1>
                    <p className="text-sm text-brand-text-secondary max-w-sm mx-auto">
                        Nhập email đã đăng ký, chúng tôi sẽ gửi hướng dẫn đặt lại mật khẩu cho bạn.
                    </p>
                </div>

                <div className="card">
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-brand-text-primary mb-2">Email</label>
                            <div className="relative">
                                <Mail className="w-4 h-4 text-brand-text-muted absolute left-4 top-1/2 -translate-y-1/2" />
                                <input type="email" placeholder="you@email.com" className="input-field !pl-11" />
                            </div>
                        </div>
                        <button className="btn-primary w-full flex items-center justify-center gap-2">
                            Gửi hướng dẫn <ArrowRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                <div className="text-center mt-6">
                    <Link href="/dang-nhap" className="text-sm text-brand-text-secondary hover:text-brand-primary transition-colors inline-flex items-center gap-1">
                        <ArrowLeft className="w-4 h-4" /> Quay lại đăng nhập
                    </Link>
                </div>
            </div>
        </div>
    );
}
