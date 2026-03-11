'use client';

import { useState } from 'react';
import { useTheme, allThemes, allDecorations, decorationAutoSchedule } from '@/lib/theme-provider';
import { Check, Sun, Moon, Zap, Clock, Palette, Sparkles } from 'lucide-react';

export default function AdminThemePage() {
    const { themeId, setThemeId, decorationId, setDecorationId, autoSwitch, setAutoSwitch } = useTheme();
    const [toast, setToast] = useState('');

    const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

    const applyTheme = (id: string) => {
        setThemeId(id);
        const theme = allThemes.find(t => t.id === id);
        showToast(`🎨 Đã chuyển sang giao diện "${theme?.name}"!`);
    };

    const applyDecoration = (id: string) => {
        setDecorationId(id);
        const d = allDecorations.find(dec => dec.id === id);
        showToast(id === 'none' ? '🚫 Đã tắt trang trí' : `✨ Đã bật trang trí "${d?.name}"!`);
    };

    const toggleAutoSwitch = () => {
        const next = !autoSwitch;
        setAutoSwitch(next);
        showToast(next ? '⚡ Tự động trang trí: BẬT — Sẽ tự đổi theo sự kiện' : '⚡ Tự động trang trí: TẮT');
    };

    const currentTheme = allThemes.find(t => t.id === themeId) || allThemes[0];
    const currentDecor = allDecorations.find(d => d.id === decorationId) || allDecorations[0];

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-xl font-bold text-brand-text-primary mb-1">Quản lý giao diện</h1>
                <p className="text-sm text-brand-text-muted">Chọn giao diện nền, thêm trang trí sự kiện. <strong>Nền web không thay đổi</strong> — chỉ thêm hiệu ứng trang trí.</p>
            </div>

            {/* ==================== BASE THEME ==================== */}
            <div className="card">
                <div className="flex items-center gap-2 mb-4">
                    <Palette className="w-4 h-4 text-brand-primary" />
                    <h3 className="text-sm font-semibold text-brand-text-primary">Giao diện nền</h3>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    {allThemes.map(theme => {
                        const isActive = theme.id === themeId;
                        const Icon = theme.id === 'dark' ? Moon : Sun;
                        return (
                            <div key={theme.id}
                                className={`card cursor-pointer transition-all hover:shadow-card-hover ${isActive ? 'border-2 border-brand-primary ring-2 ring-brand-primary/20' : 'hover:border-brand-primary/30'}`}
                                onClick={() => applyTheme(theme.id)}>
                                <div className="flex items-start justify-between mb-3">
                                    <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: theme.preview.primary }}>
                                        <Icon className="w-6 h-6 text-white" />
                                    </div>
                                    {isActive && (
                                        <div className="w-6 h-6 rounded-full bg-brand-success flex items-center justify-center">
                                            <Check className="w-3.5 h-3.5 text-white" />
                                        </div>
                                    )}
                                </div>
                                <h3 className="text-sm font-semibold text-brand-text-primary">{theme.name}</h3>
                                <p className="text-xs text-brand-text-muted mt-0.5">{theme.description}</p>
                                <div className="flex gap-1.5 mt-3">
                                    <div className="h-4 flex-1 rounded-md border border-brand-border/30" style={{ background: theme.preview.bg }} />
                                    <div className="h-4 flex-1 rounded-md border border-brand-border/30" style={{ background: theme.preview.surface }} />
                                    <div className="h-4 flex-1 rounded-md border border-brand-border/30" style={{ background: theme.preview.primary }} />
                                    <div className="h-4 flex-1 rounded-md border border-brand-border/30" style={{ background: theme.preview.accent }} />
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* ==================== AUTO DECORATION ==================== */}
            <div className="card border-2 border-brand-primary/20">
                <div className="flex items-center justify-between">
                    <div>
                        <div className="text-sm font-semibold text-brand-text-primary flex items-center gap-2">
                            <Zap className="w-4 h-4 text-brand-warning" /> Tự động trang trí theo sự kiện
                        </div>
                        <div className="text-xs text-brand-text-muted mt-0.5">
                            {autoSwitch ? '🟢 BẬT — Tự thêm trang trí khi đến ngày lễ/sự kiện' : '⚪ TẮT — Chọn trang trí thủ công'}
                        </div>
                    </div>
                    <button onClick={toggleAutoSwitch}
                        className={`w-14 h-7 rounded-full cursor-pointer transition-all relative ${autoSwitch ? 'bg-brand-primary' : 'bg-brand-surface-3'}`}>
                        <div className={`bg-white rounded-full absolute top-[3px] shadow transition-all ${autoSwitch ? 'left-[30px]' : 'left-[3px]'}`}
                            style={{ width: '22px', height: '22px' }} />
                    </button>
                </div>

                {autoSwitch && (
                    <div className="mt-4 bg-brand-surface-2 rounded-xl p-3">
                        <div className="text-[10px] uppercase text-brand-text-muted tracking-wider mb-2">Lịch sự kiện</div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            {decorationAutoSchedule.map(s => {
                                const d = allDecorations.find(dec => dec.id === s.decorationId);
                                return (
                                    <div key={s.decorationId} className="text-xs flex items-center gap-1.5 p-1.5 rounded-lg bg-brand-surface/50">
                                        <span>{d?.emoji}</span>
                                        <span className="text-brand-text-secondary">{d?.name.split(' ')[0]}: {s.startDay}/{s.startMonth}–{s.endDay}/{s.endMonth}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            {/* ==================== DECORATION CARDS ==================== */}
            <div className="card">
                <div className="flex items-center gap-2 mb-1">
                    <Sparkles className="w-4 h-4 text-brand-primary" />
                    <h3 className="text-sm font-semibold text-brand-text-primary">Trang trí sự kiện</h3>
                </div>
                <p className="text-xs text-brand-text-muted mb-4">Thêm hiệu ứng trang trí (hoa rơi, tuyết, pháo hoa...) mà <strong>không thay đổi màu nền</strong>.</p>

                {/* Current decoration status */}
                <div className="flex items-center gap-3 p-3 rounded-xl bg-brand-surface-2/80 mb-4">
                    <span className="text-2xl">{currentDecor.emoji}</span>
                    <div>
                        <div className="text-sm font-semibold text-brand-text-primary">Hiện tại: {currentDecor.name}</div>
                        <div className="text-xs text-brand-text-muted">{currentDecor.description}</div>
                    </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                    {allDecorations.map(d => {
                        const isActive = d.id === decorationId;
                        const schedule = decorationAutoSchedule.find(s => s.decorationId === d.id);
                        return (
                            <div key={d.id}
                                className={`relative p-4 rounded-2xl border-2 cursor-pointer transition-all hover:shadow-md ${isActive
                                    ? 'border-brand-primary bg-brand-primary/5 ring-2 ring-brand-primary/20'
                                    : 'border-brand-border hover:border-brand-primary/30 bg-brand-surface'
                                    }`}
                                onClick={() => applyDecoration(d.id)}>
                                {isActive && (
                                    <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-brand-success flex items-center justify-center">
                                        <Check className="w-3 h-3 text-white" />
                                    </div>
                                )}
                                <div className="text-3xl mb-2">{d.emoji}</div>
                                <div className="text-xs font-semibold text-brand-text-primary">{d.name}</div>
                                <div className="text-[10px] text-brand-text-muted mt-0.5 line-clamp-2">{d.description}</div>

                                {/* Particle preview */}
                                {d.particles.length > 0 && (
                                    <div className="flex gap-1 mt-2">
                                        {d.particles.slice(0, 4).map((p, i) => (
                                            <span key={i} className="text-sm opacity-60">{p}</span>
                                        ))}
                                    </div>
                                )}

                                {schedule && (
                                    <div className="mt-2 text-[9px] text-brand-text-muted flex items-center gap-1">
                                        <Clock className="w-2.5 h-2.5" />
                                        {schedule.startDay}/{schedule.startMonth}–{schedule.endDay}/{schedule.endMonth}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {toast && <div className="fixed bottom-6 right-6 z-50 bg-brand-surface border border-brand-border rounded-xl shadow-card-hover px-5 py-3 animate-slide-up"><span className="text-sm text-brand-text-primary font-medium">{toast}</span></div>}
        </div>
    );
}
