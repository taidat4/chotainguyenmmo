'use client';

import { useState, useEffect } from 'react';
import { MessageSquare, Save, Loader2 } from 'lucide-react';
import ChatBox from '@/components/shared/ChatBox';

export default function SellerMessagesPage() {
    const [autoReply, setAutoReply] = useState('');
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') || '' : '';

    // Load auto-reply from server
    useEffect(() => {
        fetch('/api/v1/seller/auto-reply', {
            headers: { Authorization: `Bearer ${token}` },
        }).then(r => r.json()).then(d => {
            if (d.success) setAutoReply(d.data?.message || '');
        }).catch(() => {});
    }, []);

    const saveAutoReply = async () => {
        setSaving(true);
        try {
            const res = await fetch('/api/v1/seller/auto-reply', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ message: autoReply }),
            });
            const data = await res.json();
            if (data.success) {
                setSaved(true);
                setTimeout(() => setSaved(false), 3000);
            }
        } catch {}
        setSaving(false);
    };

    return (
        <div className="space-y-4">
            {/* Auto-reply setting */}
            <div className="card !p-3 bg-brand-info/5 border-brand-info/20">
                <div className="flex items-center gap-2 mb-2">
                    <MessageSquare className="w-4 h-4 text-brand-info" />
                    <span className="text-xs font-medium text-brand-text-primary">Tin nhắn tự động</span>
                    <span className="text-[10px] text-brand-text-muted">(gửi chào khi khách nhắn lần đầu)</span>
                    {saved && <span className="text-[10px] text-brand-success font-medium">✅ Đã lưu!</span>}
                </div>
                <div className="flex items-center gap-2">
                    <input
                        type="text"
                        value={autoReply}
                        onChange={e => setAutoReply(e.target.value)}
                        placeholder="VD: Cảm ơn bạn đã liên hệ! Mình sẽ phản hồi sớm nhất."
                        className="input-field flex-1 !py-1.5 text-xs"
                    />
                    <button onClick={saveAutoReply} disabled={saving} className="btn-primary !py-1.5 !px-4 text-xs flex items-center gap-1">
                        {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                        Lưu
                    </button>
                </div>
            </div>

            <ChatBox
                title="Tin nhắn"
                subtitle="Trao đổi với khách hàng và hỗ trợ."
                roleLabelPartner={(type) => type === 'admin' ? '🛡️ Admin' : '🛒 Khách hàng'}
            />
        </div>
    );
}
