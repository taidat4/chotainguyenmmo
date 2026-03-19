'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/lib/auth-context';
import { MessageSquare, Send, Search, User, Clock, ChevronLeft, Loader2, MoreVertical, Circle, Settings, Bot, CheckCircle2 } from 'lucide-react';

interface ChatUser {
    id: string;
    username: string;
    fullName: string;
    role: string;
    avatarUrl?: string | null;
    shopName?: string | null;
    lastMessage?: string;
    lastTime?: string;
    unread?: number;
    online?: boolean;
}

interface Message {
    id: string;
    senderId: string;
    content: string;
    timestamp: string;
    isAdmin: boolean;
}

export default function AdminChatPage() {
    const { user } = useAuth();
    const [chatUsers, setChatUsers] = useState<ChatUser[]>([]);
    const [selectedUser, setSelectedUser] = useState<ChatUser | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [showAutoReply, setShowAutoReply] = useState(false);
    const [autoReplyText, setAutoReplyText] = useState('');
    const [autoReplySaved, setAutoReplySaved] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') || localStorage.getItem('token') || '' : '';

    // Load all users who have conversations or all users
    useEffect(() => {
        loadChatUsers();
        // Poll for user list updates
        const interval = setInterval(loadChatUsers, 10000);
        return () => clearInterval(interval);
    }, []);

    // Poll messages for selected user
    useEffect(() => {
        if (!selectedUser) return;
        const interval = setInterval(() => loadMessages(selectedUser.id), 5000);
        return () => clearInterval(interval);
    }, [selectedUser?.id]);

    // Load auto-reply setting
    useEffect(() => {
        fetch('/api/v1/admin/settings/auto-reply', {
            headers: { Authorization: `Bearer ${token}` },
        }).then(r => r.json()).then(data => {
            if (data.success && data.data?.message) {
                setAutoReplyText(data.data.message);
            }
        }).catch(() => {});
    }, []);

    const loadChatUsers = async () => {
        try {
            const res = await fetch('/api/v1/admin/chat?list=true', {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json();
            if (data.success) {
                setChatUsers(data.data.map((u: any) => ({
                    id: u.id,
                    username: u.username,
                    fullName: u.fullName,
                    role: u.role,
                    avatarUrl: u.avatarUrl || null,
                    shopName: u.shopName || null,
                    lastMessage: u.lastMessage || '',
                    lastTime: u.lastTime ? new Date(u.lastTime).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }) : '',
                    unread: u.unread || 0,
                    online: false,
                })));
            }
        } catch { }
        setLoading(false);
    };

    const loadMessages = async (userId: string) => {
        try {
            const res = await fetch(`/api/v1/admin/chat?userId=${userId}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json();
            if (data.success) setMessages(data.data || []);
            else setMessages([]);
        } catch {
            setMessages([]);
        }
    };

    const handleSelectUser = (chatUser: ChatUser) => {
        setSelectedUser({ ...chatUser, unread: 0 });
        // Clear unread in the list too
        setChatUsers(prev => prev.map(u => u.id === chatUser.id ? { ...u, unread: 0 } : u));
        loadMessages(chatUser.id);
    };

    const handleSendMessage = async () => {
        if (!newMessage.trim() || !selectedUser) return;
        setSending(true);
        const tempMsg: Message = {
            id: `temp_${Date.now()}`,
            senderId: user?.id || 'admin',
            content: newMessage.trim(),
            timestamp: new Date().toISOString(),
            isAdmin: true,
        };
        setMessages(prev => [...prev, tempMsg]);
        setNewMessage('');

        try {
            await fetch('/api/v1/admin/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ userId: selectedUser.id, message: tempMsg.content }),
            });
        } catch { }
        setSending(false);
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    };

    const handleSaveAutoReply = async () => {
        try {
            const res = await fetch('/api/v1/admin/settings/auto-reply', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ message: autoReplyText }),
            });
            const data = await res.json();
            if (data.success) {
                setAutoReplySaved(true);
                setTimeout(() => { setAutoReplySaved(false); setShowAutoReply(false); }, 1500);
            }
        } catch {}
    };

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const filteredUsers = chatUsers.filter(u =>
        !search ||
        (u.fullName || '').toLowerCase().includes(search.toLowerCase()) ||
        (u.username || '').toLowerCase().includes(search.toLowerCase()) ||
        (u.shopName || '').toLowerCase().includes(search.toLowerCase())
    );

    const roleColors: Record<string, string> = {
        USER: 'text-brand-text-muted',
        SELLER: 'text-brand-primary',
        ADMIN: 'text-brand-danger',
        SUPER_ADMIN: 'text-brand-danger',
    };

    const avatarBg: Record<string, string> = {
        USER: 'from-blue-400 to-cyan-400',
        SELLER: 'from-emerald-400 to-teal-500',
        ADMIN: 'from-red-400 to-pink-500',
        SUPER_ADMIN: 'from-red-400 to-pink-500',
    };

    const getDisplayName = (cu: ChatUser) => cu.shopName || cu.fullName;

    const renderAvatar = (cu: ChatUser, size = 'w-10 h-10') => {
        if (cu.avatarUrl) {
            return <img src={cu.avatarUrl} className={`${size} rounded-full object-cover`} alt="" />;
        }
        return (
            <div className={`${size} rounded-full bg-gradient-to-br ${avatarBg[cu.role] || avatarBg.USER} flex items-center justify-center`}>
                <span className="text-white text-xs font-bold">{getDisplayName(cu).charAt(0).toUpperCase()}</span>
            </div>
        );
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-bold text-brand-text-primary mb-1">💬 Tin nhắn</h1>
                    <p className="text-sm text-brand-text-muted">Chat trực tiếp với người dùng và người bán</p>
                </div>
                <button onClick={() => setShowAutoReply(!showAutoReply)}
                    className={`flex items-center gap-2 text-sm px-4 py-2 rounded-xl border transition-all ${showAutoReply ? 'bg-brand-primary text-white border-brand-primary' : 'border-brand-border text-brand-text-secondary hover:bg-brand-surface-2'}`}>
                    <Bot className="w-4 h-4" /> Tin nhắn tự động
                </button>
            </div>

            {/* Auto-reply settings panel */}
            {showAutoReply && (
                <div className="card border-brand-primary/30">
                    <div className="flex items-center gap-2 mb-3">
                        <Bot className="w-5 h-5 text-brand-primary" />
                        <h3 className="text-sm font-semibold text-brand-text-primary">Cài đặt tin nhắn tự động</h3>
                        {autoReplySaved && <span className="flex items-center gap-1 text-xs text-brand-success"><CheckCircle2 className="w-3 h-3" /> Đã lưu!</span>}
                    </div>
                    <p className="text-xs text-brand-text-muted mb-3">Khi bật, mỗi lần người dùng gửi tin nhắn sẽ nhận được phản hồi tự động. Để trống để tắt.</p>
                    <textarea
                        value={autoReplyText}
                        onChange={e => setAutoReplyText(e.target.value)}
                        placeholder="Ví dụ: Cảm ơn bạn đã liên hệ! Admin sẽ phản hồi sớm nhất có thể. ⏱️"
                        rows={3}
                        className="input-field text-sm mb-3 resize-none"
                    />
                    <div className="flex items-center gap-3">
                        <button onClick={handleSaveAutoReply} className="btn-primary !py-2 !px-5 text-sm">
                            Lưu cài đặt
                        </button>
                        {autoReplyText && (
                            <button onClick={() => { setAutoReplyText(''); handleSaveAutoReply(); }} className="btn-secondary !py-2 !px-4 text-sm text-brand-danger">
                                Tắt tự động
                            </button>
                        )}
                    </div>
                </div>
            )}

            <div className="card !p-0 overflow-hidden" style={{ height: 'calc(100vh - 200px)', minHeight: 500 }}>
                <div className="flex h-full">
                    {/* User list */}
                    <div className={`w-80 border-r border-brand-border flex flex-col shrink-0 ${selectedUser ? 'hidden lg:flex' : 'flex'}`}>
                        <div className="p-3 border-b border-brand-border">
                            <div className="relative">
                                <Search className="w-4 h-4 text-brand-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
                                <input
                                    type="text" value={search} onChange={e => setSearch(e.target.value)}
                                    placeholder="Tìm người dùng..."
                                    className="w-full pl-9 pr-3 py-2 text-sm bg-brand-surface-2 border border-brand-border/50 rounded-xl outline-none focus:border-brand-primary/50"
                                />
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto">
                            {loading ? (
                                <div className="flex items-center justify-center py-10">
                                    <Loader2 className="w-5 h-5 animate-spin text-brand-text-muted" />
                                </div>
                            ) : filteredUsers.length === 0 ? (
                                <div className="text-center py-10 text-sm text-brand-text-muted">Không có người dùng</div>
                            ) : (
                                filteredUsers.map(cu => (
                                    <button
                                        key={cu.id}
                                        onClick={() => handleSelectUser(cu)}
                                        className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-brand-surface-2 transition-all border-b border-brand-border/30 ${selectedUser?.id === cu.id ? 'bg-brand-primary/5 border-l-2 border-l-brand-primary' : ''}`}
                                    >
                                        <div className="relative shrink-0">
                                            {renderAvatar(cu)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between">
                                                <span className={`text-sm truncate ${(cu.unread || 0) > 0 ? 'font-bold text-brand-text-primary' : 'font-semibold text-brand-text-primary'}`}>{getDisplayName(cu)}</span>
                                                <span className={`text-[10px] font-medium shrink-0 ${roleColors[cu.role] || 'text-brand-text-muted'}`}>{cu.role}</span>
                                            </div>
                                            <div className={`text-xs truncate ${(cu.unread || 0) > 0 ? 'font-semibold text-brand-text-primary' : 'text-brand-text-muted'}`}>
                                                {cu.shopName ? `@${cu.username}` : `@${cu.username}`}
                                                {cu.lastMessage ? ` · ${cu.lastMessage}` : ''}
                                            </div>
                                        </div>
                                        <div className="flex flex-col items-end gap-1 shrink-0">
                                            {cu.lastTime && <span className="text-[10px] text-brand-text-muted whitespace-nowrap">{cu.lastTime}</span>}
                                            {(cu.unread || 0) > 0 && (
                                                <span className="min-w-[18px] h-[18px] rounded-full bg-brand-danger text-white text-[10px] font-bold flex items-center justify-center px-1">
                                                    {(cu.unread || 0) > 99 ? '99+' : cu.unread}
                                                </span>
                                            )}
                                        </div>
                                    </button>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Chat area */}
                    <div className={`flex-1 flex flex-col ${!selectedUser ? 'hidden lg:flex' : 'flex'}`}>
                        {selectedUser ? (
                            <>
                                {/* Chat header */}
                                <div className="px-4 py-3 border-b border-brand-border flex items-center gap-3">
                                    <button onClick={() => setSelectedUser(null)} className="lg:hidden p-1.5 rounded-lg hover:bg-brand-surface-2">
                                        <ChevronLeft className="w-5 h-5 text-brand-text-secondary" />
                                    </button>
                                    {renderAvatar(selectedUser, 'w-9 h-9')}
                                    <div className="flex-1">
                                        <div className="text-sm font-semibold text-brand-text-primary">{getDisplayName(selectedUser)}</div>
                                        <div className="text-xs text-brand-text-muted">@{selectedUser.username} · {selectedUser.role}</div>
                                    </div>
                                </div>

                                {/* Messages */}
                                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                                    {messages.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center h-full text-brand-text-muted">
                                            <MessageSquare className="w-12 h-12 mb-3 opacity-20" />
                                            <p className="text-sm">Chưa có tin nhắn</p>
                                            <p className="text-xs mt-1">Gửi tin nhắn đầu tiên để bắt đầu cuộc trò chuyện</p>
                                        </div>
                                    ) : (
                                        messages.map(msg => (
                                            <div key={msg.id} className={`flex ${msg.isAdmin ? 'justify-end' : 'justify-start'}`}>
                                                <div className={`max-w-[70%] rounded-2xl px-4 py-2.5 ${msg.isAdmin
                                                    ? 'bg-brand-primary text-white rounded-br-md'
                                                    : 'bg-brand-surface-2 text-brand-text-primary rounded-bl-md'
                                                    }`}>
                                                    <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                                                    <div className={`text-[10px] mt-1 ${msg.isAdmin ? 'text-white/70' : 'text-brand-text-muted'}`}>
                                                        {new Date(msg.timestamp).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                    <div ref={messagesEndRef} />
                                </div>

                                {/* Input */}
                                <div className="px-4 py-3 border-t border-brand-border">
                                    <div className="flex gap-2">
                                        <input
                                            type="text" value={newMessage}
                                            onChange={e => setNewMessage(e.target.value)}
                                            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                                            placeholder="Nhập tin nhắn..."
                                            className="flex-1 px-4 py-2.5 text-sm bg-brand-surface-2 border border-brand-border/50 rounded-xl outline-none focus:border-brand-primary/50"
                                        />
                                        <button
                                            onClick={handleSendMessage}
                                            disabled={!newMessage.trim() || sending}
                                            className="px-4 py-2.5 bg-brand-primary text-white rounded-xl hover:bg-brand-primary/90 disabled:opacity-50 transition-all"
                                        >
                                            <Send className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full text-brand-text-muted">
                                <MessageSquare className="w-16 h-16 mb-4 opacity-15" />
                                <h3 className="text-base font-semibold text-brand-text-secondary mb-1">Chọn cuộc trò chuyện</h3>
                                <p className="text-sm">Chọn người dùng từ danh sách bên trái để bắt đầu chat</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
