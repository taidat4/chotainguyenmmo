'use client';

import { User, Mail, Phone, MapPin, Calendar, Camera, Save } from 'lucide-react';

export default function ProfilePage() {
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-xl font-bold text-brand-text-primary mb-1">Hồ sơ cá nhân</h1>
                <p className="text-sm text-brand-text-muted">Quản lý thông tin cá nhân, ảnh đại diện và thông tin liên hệ của bạn.</p>
            </div>

            {/* Avatar Section */}
            <div className="card flex flex-col sm:flex-row items-center gap-6">
                <div className="relative">
                    <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-brand-primary to-brand-secondary flex items-center justify-center">
                        <span className="text-white text-3xl font-bold">--</span>
                    </div>
                    <button className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full bg-brand-primary flex items-center justify-center text-white hover:brightness-110 transition-all shadow-lg">
                        <Camera className="w-4 h-4" />
                    </button>
                </div>
                <div className="text-center sm:text-left">
                    <h2 className="text-lg font-semibold text-brand-text-primary">Chưa cập nhật</h2>
                    <p className="text-sm text-brand-text-muted">Thành viên mới</p>
                    <div className="flex items-center gap-2 mt-2 justify-center sm:justify-start">
                        <span className="badge-success">Đã xác minh</span>
                        <span className="badge-primary">Người mua</span>
                    </div>
                </div>
            </div>

            {/* Personal Info */}
            <div className="card">
                <h3 className="text-sm font-semibold text-brand-text-primary mb-5">Thông tin cá nhân</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                        <label className="block text-sm font-medium text-brand-text-primary mb-2">Họ và tên</label>
                        <div className="relative">
                            <User className="w-4 h-4 text-brand-text-muted absolute left-4 top-1/2 -translate-y-1/2" />
                            <input type="text" defaultValue="" placeholder="Nhập họ và tên" className="input-field !pl-11" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-brand-text-primary mb-2">Email</label>
                        <div className="relative">
                            <Mail className="w-4 h-4 text-brand-text-muted absolute left-4 top-1/2 -translate-y-1/2" />
                            <input type="email" defaultValue="" placeholder="Nhập email" className="input-field !pl-11" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-brand-text-primary mb-2">Số điện thoại</label>
                        <div className="relative">
                            <Phone className="w-4 h-4 text-brand-text-muted absolute left-4 top-1/2 -translate-y-1/2" />
                            <input type="tel" defaultValue="" placeholder="Nhập số điện thoại" className="input-field !pl-11" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-brand-text-primary mb-2">Địa chỉ</label>
                        <div className="relative">
                            <MapPin className="w-4 h-4 text-brand-text-muted absolute left-4 top-1/2 -translate-y-1/2" />
                            <input type="text" defaultValue="" placeholder="Nhập địa chỉ" className="input-field !pl-11" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-brand-text-primary mb-2">Ngày sinh</label>
                        <div className="relative">
                            <Calendar className="w-4 h-4 text-brand-text-muted absolute left-4 top-1/2 -translate-y-1/2" />
                            <input type="date" defaultValue="" className="input-field !pl-11" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-brand-text-primary mb-2">Giới tính</label>
                        <select className="input-field">
                            <option>Nam</option>
                            <option>Nữ</option>
                            <option>Khác</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Account Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                    { label: 'Tổng đơn hàng', value: '0' },
                    { label: 'Đơn hoàn tất', value: '0' },
                    { label: 'Tổng chi tiêu', value: '0đ' },
                    { label: 'Sản phẩm yêu thích', value: '0' },
                ].map((stat, i) => (
                    <div key={i} className="card !p-4 text-center">
                        <div className="text-lg font-bold text-brand-text-primary">{stat.value}</div>
                        <div className="text-xs text-brand-text-muted mt-1">{stat.label}</div>
                    </div>
                ))}
            </div>

            {/* Save Button */}
            <div className="flex justify-end">
                <button className="btn-primary flex items-center gap-2">
                    <Save className="w-4 h-4" /> Lưu thay đổi
                </button>
            </div>
        </div>
    );
}
