'use client';

import { useState } from 'react';
import { Search, Eye, Ban, Users, UserCheck, UserX, PlusCircle, MinusCircle, History, Shield, X, Lock, Unlock, Trash2 } from 'lucide-react';

const initialUsers: { id: number; name: string; username: string; email: string; role: string; status: string; balance: number; orders: number; joined: string; history: { type: string; amount: number; date: string; desc: string }[] }[] = [];

type ModalType = 'balance' | 'history' | 'ban' | 'delete' | null;
type BalanceAction = 'add' | 'subtract';

export default function AdminUsersPage() {
    const [users, setUsers] = useState(initialUsers);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [modal, setModal] = useState<{ type: ModalType; userId: number | null }>({ type: null, userId: null });
    const [balanceAction, setBalanceAction] = useState<BalanceAction>('add');
    const [balanceAmount, setBalanceAmount] = useState('');
    const [balanceNote, setBalanceNote] = useState('');
    const [toast, setToast] = useState('');

    const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

    const filtered = users.filter(u => {
        const matchSearch = !searchTerm || u.name.toLowerCase().includes(searchTerm.toLowerCase()) || u.email.toLowerCase().includes(searchTerm.toLowerCase()) || u.username.toLowerCase().includes(searchTerm.toLowerCase());
        const matchStatus = statusFilter === 'all' || u.status === statusFilter;
        return matchSearch && matchStatus;
    });

    const handleBalanceChange = () => {
        const amount = parseInt(balanceAmount);
        if (!amount || !modal.userId) return;
        setUsers(prev => prev.map(u => {
            if (u.id === modal.userId) {
                const newBalance = balanceAction === 'add' ? u.balance + amount : Math.max(0, u.balance - amount);
                return { ...u, balance: newBalance };
            }
            return u;
        }));
        setModal({ type: null, userId: null });
        setBalanceAmount('');
        setBalanceNote('');
        showToast(`✅ Đã ${balanceAction === 'add' ? 'cộng' : 'trừ'} ${amount.toLocaleString('vi-VN')}đ`);
    };

    const handleBan = (userId: number, action: 'suspend' | 'ban' | 'unban') => {
        setUsers(prev => prev.map(u => {
            if (u.id === userId) {
                return { ...u, status: action === 'unban' ? 'active' : action === 'ban' ? 'banned' : 'suspended' };
            }
            return u;
        }));
        setModal({ type: null, userId: null });
        showToast(action === 'unban' ? '✅ Đã mở khóa' : action === 'ban' ? '🚫 Đã ban vĩnh viễn' : '🔒 Đã tạm khóa');
    };

    const handleDelete = (userId: number) => {
        setUsers(prev => prev.filter(u => u.id !== userId));
        setModal({ type: null, userId: null });
        showToast('🗑️ Đã xóa người dùng');
    };

    const selectedUser = modal.userId ? users.find(u => u.id === modal.userId) : null;

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-xl font-bold text-brand-text-primary mb-1">Quản lý người dùng</h1>
                <p className="text-sm text-brand-text-muted">Xem, tìm kiếm, cộng/trừ tiền, khóa tạm hoặc ban vĩnh viễn người dùng.</p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                    { label: 'Tổng users', value: users.length, icon: Users, color: 'text-brand-primary' },
                    { label: 'Active', value: users.filter(u => u.status === 'active').length, icon: UserCheck, color: 'text-brand-success' },
                    { label: 'Suspended', value: users.filter(u => u.status === 'suspended').length, icon: UserX, color: 'text-brand-warning' },
                    { label: 'Banned', value: users.filter(u => u.status === 'banned').length, icon: Shield, color: 'text-brand-danger' },
                ].map((s, i) => (
                    <div key={i} className="card !p-4">
                        <div className="flex items-center gap-2 mb-2">
                            <s.icon className={`w-4 h-4 ${s.color}`} />
                            <span className="text-xs text-brand-text-muted">{s.label}</span>
                        </div>
                        <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
                    </div>
                ))}
            </div>

            {/* Search & Filter */}
            <div className="card !p-4 flex flex-col sm:flex-row gap-3">
                <div className="flex-1 relative">
                    <Search className="w-4 h-4 text-brand-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
                    <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Tìm theo tên, email, username..." className="input-field !py-2 !pl-10 text-sm w-full" />
                </div>
                <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="input-field !py-2 text-sm min-w-[140px]">
                    <option value="all">Tất cả</option>
                    <option value="active">Active</option>
                    <option value="suspended">Suspended</option>
                    <option value="banned">Banned</option>
                </select>
            </div>

            {/* Table */}
            <div className="card !p-0 overflow-hidden">
                <table className="w-full text-sm">
                    <thead><tr className="bg-brand-surface-2/50">
                        <th className="text-left text-xs text-brand-text-muted font-medium py-3 px-4">Người dùng</th>
                        <th className="text-right text-xs text-brand-text-muted font-medium py-3 px-4">Số dư</th>
                        <th className="text-center text-xs text-brand-text-muted font-medium py-3 px-4">Đơn hàng</th>
                        <th className="text-center text-xs text-brand-text-muted font-medium py-3 px-4">Trạng thái</th>
                        <th className="text-center text-xs text-brand-text-muted font-medium py-3 px-4">Thao tác</th>
                    </tr></thead>
                    <tbody>
                        {filtered.map(u => (
                            <tr key={u.id} className="border-t border-brand-border/50 hover:bg-brand-surface-2/30">
                                <td className="py-3 px-4">
                                    <div className="text-sm font-medium text-brand-text-primary">{u.name}</div>
                                    <div className="text-xs text-brand-text-muted">@{u.username} · {u.email}</div>
                                </td>
                                <td className="py-3 px-4 text-right text-brand-text-primary font-semibold">{u.balance.toLocaleString('vi-VN')}đ</td>
                                <td className="py-3 px-4 text-center text-brand-text-secondary">{u.orders}</td>
                                <td className="py-3 px-4 text-center">
                                    <span className={`badge text-[10px] ${u.status === 'active' ? 'badge-success' : u.status === 'suspended' ? 'badge-warning' : 'badge-danger'}`}>
                                        {u.status === 'active' ? 'Active' : u.status === 'suspended' ? 'Tạm khóa' : 'Banned'}
                                    </span>
                                </td>
                                <td className="py-3 px-4">
                                    <div className="flex items-center justify-center gap-1">
                                        <button onClick={() => setModal({ type: 'balance', userId: u.id })} className="p-1.5 rounded-lg text-brand-text-muted hover:text-brand-success hover:bg-brand-success/10 transition-colors" title="Cộng/Trừ tiền">
                                            <PlusCircle className="w-4 h-4" />
                                        </button>
                                        <button onClick={() => setModal({ type: 'history', userId: u.id })} className="p-1.5 rounded-lg text-brand-text-muted hover:text-brand-primary hover:bg-brand-primary/10 transition-colors" title="Lịch sử">
                                            <History className="w-4 h-4" />
                                        </button>
                                        {u.status === 'active' ? (
                                            <button onClick={() => setModal({ type: 'ban', userId: u.id })} className="p-1.5 rounded-lg text-brand-text-muted hover:text-brand-danger hover:bg-brand-danger/10 transition-colors" title="Khóa/Ban">
                                                <Lock className="w-4 h-4" />
                                            </button>
                                        ) : (
                                            <button onClick={() => handleBan(u.id, 'unban')} className="p-1.5 rounded-lg text-brand-text-muted hover:text-brand-success hover:bg-brand-success/10 transition-colors" title="Mở khóa">
                                                <Unlock className="w-4 h-4" />
                                            </button>
                                        )}
                                        <button onClick={() => setModal({ type: 'delete', userId: u.id })} className="p-1.5 rounded-lg text-brand-text-muted hover:text-brand-danger hover:bg-brand-danger/10 transition-colors" title="Xóa">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Balance Modal */}
            {modal.type === 'balance' && selectedUser && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                    <div className="bg-brand-surface rounded-2xl p-6 w-[420px] shadow-card-hover border border-brand-border">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold text-brand-text-primary">Cộng/Trừ tiền cho {selectedUser.name}</h3>
                            <button onClick={() => setModal({ type: null, userId: null })} className="p-1 rounded-lg hover:bg-brand-surface-2"><X className="w-4 h-4" /></button>
                        </div>
                        <p className="text-sm text-brand-text-muted mb-4">Số dư hiện tại: <span className="font-semibold text-brand-success">{selectedUser.balance.toLocaleString('vi-VN')}đ</span></p>
                        <div className="flex gap-2 mb-4">
                            <button onClick={() => setBalanceAction('add')} className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-1.5 ${balanceAction === 'add' ? 'bg-brand-success/15 text-brand-success border border-brand-success/30' : 'bg-brand-surface-2 text-brand-text-muted'}`}>
                                <PlusCircle className="w-4 h-4" /> Cộng tiền
                            </button>
                            <button onClick={() => setBalanceAction('subtract')} className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-1.5 ${balanceAction === 'subtract' ? 'bg-brand-danger/15 text-brand-danger border border-brand-danger/30' : 'bg-brand-surface-2 text-brand-text-muted'}`}>
                                <MinusCircle className="w-4 h-4" /> Trừ tiền
                            </button>
                        </div>
                        <input type="number" value={balanceAmount} onChange={e => setBalanceAmount(e.target.value)} placeholder="Nhập số tiền (VNĐ)..." className="input-field w-full text-sm mb-3" />
                        <input type="text" value={balanceNote} onChange={e => setBalanceNote(e.target.value)} placeholder="Ghi chú (tùy chọn)..." className="input-field w-full text-sm mb-4" />
                        <div className="flex gap-3">
                            <button onClick={() => setModal({ type: null, userId: null })} className="btn-secondary flex-1 text-sm">Hủy</button>
                            <button onClick={handleBalanceChange} className={`flex-1 py-2 rounded-xl text-sm font-medium text-white transition-all ${balanceAction === 'add' ? 'bg-brand-success hover:brightness-110' : 'bg-brand-danger hover:brightness-110'}`}>
                                Xác nhận {balanceAction === 'add' ? 'cộng' : 'trừ'} tiền
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* History Modal */}
            {modal.type === 'history' && selectedUser && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                    <div className="bg-brand-surface rounded-2xl p-6 w-[500px] shadow-card-hover border border-brand-border max-h-[80vh] overflow-y-auto">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold text-brand-text-primary">Lịch sử - {selectedUser.name}</h3>
                            <button onClick={() => setModal({ type: null, userId: null })} className="p-1 rounded-lg hover:bg-brand-surface-2"><X className="w-4 h-4" /></button>
                        </div>
                        {selectedUser.history.length > 0 ? (
                            <div className="space-y-3">
                                {selectedUser.history.map((h, i) => (
                                    <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-brand-surface-2/50">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${h.amount > 0 ? 'bg-brand-success/15' : 'bg-brand-danger/15'}`}>
                                            {h.amount > 0 ? <PlusCircle className="w-4 h-4 text-brand-success" /> : <MinusCircle className="w-4 h-4 text-brand-danger" />}
                                        </div>
                                        <div className="flex-1">
                                            <div className="text-sm text-brand-text-primary">{h.desc}</div>
                                            <div className="text-xs text-brand-text-muted">{h.date}</div>
                                        </div>
                                        <div className={`text-sm font-semibold ${h.amount > 0 ? 'text-brand-success' : 'text-brand-danger'}`}>
                                            {h.amount > 0 ? '+' : ''}{h.amount.toLocaleString('vi-VN')}đ
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-sm text-brand-text-muted text-center py-8">Chưa có lịch sử giao dịch</p>
                        )}
                    </div>
                </div>
            )}

            {/* Ban Modal */}
            {modal.type === 'ban' && selectedUser && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                    <div className="bg-brand-surface rounded-2xl p-6 w-[400px] shadow-card-hover border border-brand-border">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold text-brand-text-primary">Khóa tài khoản</h3>
                            <button onClick={() => setModal({ type: null, userId: null })} className="p-1 rounded-lg hover:bg-brand-surface-2"><X className="w-4 h-4" /></button>
                        </div>
                        <p className="text-sm text-brand-text-muted mb-4">Chọn hình thức xử lý cho <span className="font-semibold text-brand-text-primary">{selectedUser.name}</span>:</p>
                        <div className="space-y-3">
                            <button onClick={() => handleBan(selectedUser.id, 'suspend')} className="w-full flex items-center gap-3 p-3 rounded-xl border border-brand-warning/30 bg-brand-warning/5 hover:bg-brand-warning/10 transition-colors">
                                <Lock className="w-5 h-5 text-brand-warning" />
                                <div className="text-left">
                                    <div className="text-sm font-medium text-brand-warning">Tạm khóa</div>
                                    <div className="text-xs text-brand-text-muted">Khóa tạm thời, có thể mở lại sau</div>
                                </div>
                            </button>
                            <button onClick={() => handleBan(selectedUser.id, 'ban')} className="w-full flex items-center gap-3 p-3 rounded-xl border border-brand-danger/30 bg-brand-danger/5 hover:bg-brand-danger/10 transition-colors">
                                <Ban className="w-5 h-5 text-brand-danger" />
                                <div className="text-left">
                                    <div className="text-sm font-medium text-brand-danger">Ban vĩnh viễn</div>
                                    <div className="text-xs text-brand-text-muted">Cấm vĩnh viễn khỏi hệ thống</div>
                                </div>
                            </button>
                        </div>
                        <button onClick={() => setModal({ type: null, userId: null })} className="btn-secondary w-full mt-4 text-sm">Hủy</button>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {modal.type === 'delete' && selectedUser && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                    <div className="bg-brand-surface rounded-2xl p-6 w-[420px] shadow-card-hover border border-brand-border">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold text-brand-danger">Xóa người dùng</h3>
                            <button onClick={() => setModal({ type: null, userId: null })} className="p-1 rounded-lg hover:bg-brand-surface-2"><X className="w-4 h-4" /></button>
                        </div>
                        <div className="bg-brand-danger/10 border border-brand-danger/30 rounded-xl p-4 mb-4 text-center">
                            <Trash2 className="w-8 h-8 text-brand-danger mx-auto mb-2" />
                            <p className="text-sm text-brand-text-primary font-medium mb-1">Bạn chắc chắn muốn xóa <span className="font-bold">{selectedUser.name}</span>?</p>
                            <p className="text-xs text-brand-text-muted">@{selectedUser.username} · {selectedUser.email}</p>
                        </div>
                        <p className="text-xs text-brand-danger mb-4 text-center">⚠️ Hành động này không thể hoàn tác!</p>
                        <div className="flex gap-3">
                            <button onClick={() => setModal({ type: null, userId: null })} className="btn-secondary flex-1 text-sm">Hủy</button>
                            <button onClick={() => handleDelete(selectedUser.id)} className="flex-1 py-2.5 bg-brand-danger hover:bg-brand-danger/90 text-white rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-1.5">
                                <Trash2 className="w-4 h-4" /> Xóa vĩnh viễn
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {toast && <div className="fixed bottom-6 right-6 z-50 bg-brand-surface border border-brand-border rounded-xl shadow-card-hover px-5 py-3 animate-slide-up"><span className="text-sm text-brand-text-primary font-medium">{toast}</span></div>}
        </div>
    );
}
