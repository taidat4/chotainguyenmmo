'use client';

import { useState, useEffect } from 'react';
import { Plus, Bell, Trash2, Eye, EyeOff, Loader2, AlertTriangle, Info, AlertCircle } from 'lucide-react';
import { useUI } from '@/components/shared/UIProvider';

interface Announcement {
    id: string;
    title: string;
    message: string;
    type: 'info' | 'warning' | 'important';
    isActive: boolean;
    createdAt: string;
}

export default function AdminAnnouncementsPage() {
    const { showToast, showConfirm } = useUI();
    const [announcements, setAnnouncements] = useState<Announcement[]>([]);
    const [loading, setLoading] = useState(true);
    const [title, setTitle] = useState('');
    const [message, setMessage] = useState('');
    const [type, setType] = useState<'info' | 'warning' | 'important'>('info');
    const [creating, setCreating] = useState(false);

    const fetchAll = async () => {
        try {
            const res = await fetch('/api/v1/announcements?all=true');
            const data = await res.json();
            if (data.success) setAnnouncements(data.data);
        } catch {}
        setLoading(false);
    };

    useEffect(() => { fetchAll(); }, []);

    const handleCreate = async () => {
        if (!title.trim() || !message.trim()) return;
        setCreating(true);
        try {
            const res = await fetch('/api/v1/announcements', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title, message, type }),
            });
            const data = await res.json();
            if (data.success) {
                setAnnouncements(prev => [data.data, ...prev]);
                setTitle('');
                setMessage('');
            }
        } catch {}
        setCreating(false);
    };

    const handleToggle = async (id: string, isActive: boolean) => {
        try {
            await fetch('/api/v1/announcements', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, isActive: !isActive }),
            });
            setAnnouncements(prev => prev.map(a => a.id === id ? { ...a, isActive: !isActive } : a));
        } catch {}
    };

    const handleDelete = async (id: string) => {
        showConfirm({
            title: 'Xóa thông báo',
            message: 'Bạn chắc chắn muốn xóa thông báo này?',
            confirmText: 'Xóa',
            variant: 'danger',
            onConfirm: async () => {
                try {
                    await fetch(`/api/v1/announcements?id=${id}`, { method: 'DELETE' });
                    setAnnouncements(prev => prev.filter(a => a.id !== id));
                    showToast('Đã xóa thông báo', 'success');
                } catch { showToast('Lỗi xóa thông báo', 'error'); }
            }
        });
    };

    const fmtDate = (d: string) => {
        try {
            const date = new Date(d);
            return `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()} ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
        } catch { return d; }
    };

    const typeIcon = (t: string) => {
        if (t === 'warning') return <AlertTriangle className="w-4 h-4 text-brand-warning" />;
        if (t === 'important') return <AlertCircle className="w-4 h-4 text-brand-danger" />;
        return <Info className="w-4 h-4 text-brand-info" />;
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-xl font-bold text-brand-text-primary mb-1">Thông báo hệ thống</h1>
                <p className="text-sm text-brand-text-muted">Tạo thông báo hiển thị popup cho tất cả người dùng khi đăng nhập.</p>
            </div>

            {/* Create Form */}
            <div className="card space-y-4">
                <h3 className="text-sm font-semibold text-brand-text-primary flex items-center gap-2">
                    <Plus className="w-4 h-4" /> Tạo thông báo mới
                </h3>
                <input
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    placeholder="Tiêu đề thông báo..."
                    className="input-field text-sm"
                />
                <textarea
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    placeholder="Nội dung thông báo..."
                    className="input-field text-sm resize-none h-24"
                />
                <div className="flex items-center gap-3">
                    <select value={type} onChange={e => setType(e.target.value as any)} className="input-field text-sm !w-40">
                        <option value="info">ℹ️ Thông tin</option>
                        <option value="warning">⚠️ Cảnh báo</option>
                        <option value="important">🔴 Quan trọng</option>
                    </select>
                    <button onClick={handleCreate} disabled={creating || !title.trim() || !message.trim()} className="btn-primary !py-2 !px-6 text-sm flex items-center gap-2">
                        {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bell className="w-4 h-4" />}
                        Tạo thông báo
                    </button>
                </div>
            </div>

            {/* Announcements List */}
            {loading ? (
                <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-brand-primary" /></div>
            ) : announcements.length === 0 ? (
                <div className="card text-center py-10">
                    <Bell className="w-10 h-10 mx-auto mb-3 text-brand-text-muted/30" />
                    <p className="text-sm text-brand-text-muted">Chưa có thông báo nào</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {announcements.map(a => (
                        <div key={a.id} className={`card !p-4 flex items-start gap-4 ${!a.isActive ? 'opacity-50' : ''}`}>
                            <div className="mt-1">{typeIcon(a.type)}</div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                    <h4 className="text-sm font-semibold text-brand-text-primary">{a.title}</h4>
                                    {a.isActive ? (
                                        <span className="badge badge-success text-[10px]">Đang hiển thị</span>
                                    ) : (
                                        <span className="badge badge-neutral text-[10px]">Đã ẩn</span>
                                    )}
                                </div>
                                <p className="text-xs text-brand-text-secondary line-clamp-2">{a.message}</p>
                                <p className="text-[10px] text-brand-text-muted mt-1">{fmtDate(a.createdAt)}</p>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                                <button onClick={() => handleToggle(a.id, a.isActive)} className="p-1.5 rounded-lg hover:bg-brand-surface-2" title={a.isActive ? 'Ẩn' : 'Hiển thị'}>
                                    {a.isActive ? <EyeOff className="w-4 h-4 text-brand-text-muted" /> : <Eye className="w-4 h-4 text-brand-text-muted" />}
                                </button>
                                <button onClick={() => handleDelete(a.id)} className="p-1.5 rounded-lg hover:bg-red-50" title="Xóa">
                                    <Trash2 className="w-4 h-4 text-brand-danger" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
