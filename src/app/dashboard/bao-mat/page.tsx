'use client';

import { Lock, Shield, Smartphone, Key, AlertTriangle, CheckCircle } from 'lucide-react';

export default function SecurityPage() {
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-xl font-bold text-brand-text-primary mb-1">Bảo mật tài khoản</h1>
                <p className="text-sm text-brand-text-muted">Thay đổi mật khẩu, thiết lập xác thực hai lớp và quản lý phiên đăng nhập.</p>
            </div>

            {/* Security Status */}
            <div className="card bg-gradient-to-r from-brand-success/5 to-brand-success/0 border-brand-success/20">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-brand-success/20 flex items-center justify-center">
                        <Shield className="w-5 h-5 text-brand-success" />
                    </div>
                    <div>
                        <div className="text-sm font-semibold text-brand-text-primary">Mức độ bảo mật: Tốt</div>
                        <div className="text-xs text-brand-text-muted">Bật xác thực 2 lớp để tăng bảo mật cho tài khoản</div>
                    </div>
                </div>
            </div>

            {/* Change Password */}
            <div className="card">
                <h3 className="text-sm font-semibold text-brand-text-primary mb-5 flex items-center gap-2">
                    <Lock className="w-4 h-4 text-brand-primary" /> Đổi mật khẩu
                </h3>
                <div className="space-y-4 max-w-md">
                    <div>
                        <label className="block text-sm font-medium text-brand-text-primary mb-2">Mật khẩu hiện tại</label>
                        <div className="relative">
                            <Key className="w-4 h-4 text-brand-text-muted absolute left-4 top-1/2 -translate-y-1/2" />
                            <input type="password" placeholder="Nhập mật khẩu hiện tại" className="input-field !pl-11" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-brand-text-primary mb-2">Mật khẩu mới</label>
                        <div className="relative">
                            <Lock className="w-4 h-4 text-brand-text-muted absolute left-4 top-1/2 -translate-y-1/2" />
                            <input type="password" placeholder="Nhập mật khẩu mới (tối thiểu 8 ký tự)" className="input-field !pl-11" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-brand-text-primary mb-2">Xác nhận mật khẩu mới</label>
                        <div className="relative">
                            <Lock className="w-4 h-4 text-brand-text-muted absolute left-4 top-1/2 -translate-y-1/2" />
                            <input type="password" placeholder="Nhập lại mật khẩu mới" className="input-field !pl-11" />
                        </div>
                    </div>
                    <button className="btn-primary">Cập nhật mật khẩu</button>
                </div>
            </div>

            {/* Two-Factor Auth */}
            <div className="card">
                <div className="flex items-center justify-between mb-5">
                    <h3 className="text-sm font-semibold text-brand-text-primary flex items-center gap-2">
                        <Smartphone className="w-4 h-4 text-brand-primary" /> Xác thực hai lớp (2FA)
                    </h3>
                    <span className="badge-warning">Chưa bật</span>
                </div>
                <p className="text-sm text-brand-text-secondary mb-4">
                    Thêm lớp bảo vệ cho tài khoản bằng cách yêu cầu mã xác thực từ ứng dụng (Google Authenticator, Authy) mỗi khi đăng nhập.
                </p>
                <button className="btn-secondary">Thiết lập 2FA</button>
            </div>

            {/* Active Sessions */}
            <div className="card">
                <h3 className="text-sm font-semibold text-brand-text-primary mb-5">Phiên đăng nhập đang hoạt động</h3>
                <div className="space-y-3">
                    {[
                        { device: 'Chrome — Windows 10', location: 'TP.HCM, Việt Nam', time: 'Đang hoạt động', current: true },
                        { device: 'Safari — iPhone 15', location: 'TP.HCM, Việt Nam', time: '2 giờ trước', current: false },
                        { device: 'Firefox — macOS', location: 'Hà Nội, Việt Nam', time: '3 ngày trước', current: false },
                    ].map((session, i) => (
                        <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-brand-surface-2/50 border border-brand-border/50">
                            <div className="flex items-center gap-3">
                                <div className={`w-2 h-2 rounded-full ${session.current ? 'bg-brand-success' : 'bg-brand-text-muted'}`} />
                                <div>
                                    <div className="text-sm font-medium text-brand-text-primary">{session.device}</div>
                                    <div className="text-xs text-brand-text-muted">{session.location} · {session.time}</div>
                                </div>
                            </div>
                            {session.current ? (
                                <span className="text-xs text-brand-success font-medium">Hiện tại</span>
                            ) : (
                                <button className="text-xs text-brand-danger hover:underline">Thu hồi</button>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* Danger Zone */}
            <div className="card border-brand-danger/30">
                <h3 className="text-sm font-semibold text-brand-danger mb-3 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" /> Vùng nguy hiểm
                </h3>
                <p className="text-sm text-brand-text-secondary mb-4">
                    Xóa vĩnh viễn tài khoản và toàn bộ dữ liệu của bạn. Hành động này không thể hoàn tác.
                </p>
                <button className="btn-danger !py-2 !px-4 text-sm">Xóa tài khoản</button>
            </div>
        </div>
    );
}
