'use client';

import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

// ============================================================
// BASE THEMES — Only Default (light) and Dark
// ============================================================
export interface ThemeColors {
    [key: string]: string;
}

export interface ThemeDef {
    id: string;
    name: string;
    description: string;
    colors: ThemeColors;
    preview: { primary: string; bg: string; surface: string; accent: string };
}

function hexToRgb(hex: string): string {
    const h = hex.replace('#', '');
    return `${parseInt(h.substring(0, 2), 16)} ${parseInt(h.substring(2, 4), 16)} ${parseInt(h.substring(4, 6), 16)}`;
}

function makeColors(map: Record<string, string>): ThemeColors {
    const result: ThemeColors = {};
    for (const [key, hex] of Object.entries(map)) {
        result[`--brand-${key}`] = hexToRgb(hex);
    }
    return result;
}

// Only 2 base themes: Light + Dark
export const allThemes: ThemeDef[] = [
    {
        id: 'default', name: 'Sáng', description: 'Giao diện sáng — Hiện đại, chuyên nghiệp',
        preview: { primary: '#2F6BFF', bg: '#F5F8FF', surface: '#FFFFFF', accent: '#7C4DFF' },
        colors: makeColors({
            primary: '#2F6BFF', secondary: '#7C4DFF', bg: '#F5F8FF',
            surface: '#FFFFFF', 'surface-2': '#F8FAFC', 'surface-3': '#EEF4FF',
            border: '#D9E2F2', 'text-primary': '#0F172A', 'text-secondary': '#475569',
            'text-muted': '#64748B', success: '#16A34A', warning: '#D97706',
            danger: '#DC2626', info: '#0284C7',
        }),
    },
    {
        id: 'dark', name: 'Tối', description: 'Chế độ tối — Dễ nhìn ban đêm',
        preview: { primary: '#818CF8', bg: '#0F172A', surface: '#1E293B', accent: '#A78BFA' },
        colors: makeColors({
            primary: '#818CF8', secondary: '#A78BFA', bg: '#0F172A',
            surface: '#1E293B', 'surface-2': '#334155', 'surface-3': '#1E293B',
            border: '#334155', 'text-primary': '#F1F5F9', 'text-secondary': '#CBD5E1',
            'text-muted': '#94A3B8', success: '#22C55E', warning: '#F59E0B',
            danger: '#EF4444', info: '#38BDF8',
        }),
    },
];

// ============================================================
// DECORATIONS — Visual overlays for events (no color changes)
// ============================================================
export interface DecorationDef {
    id: string;
    name: string;
    description: string;
    emoji: string;
    /** CSS class name suffix for the decoration */
    particles: string[];
    /** Accent color for subtle highlights on buttons/badges only */
    accentColor?: string;
}

export const allDecorations: DecorationDef[] = [
    {
        id: 'none', name: 'Không trang trí', description: 'Giao diện nguyên bản',
        emoji: '🚫', particles: [],
    },
    {
        id: 'tet', name: 'Tết Nguyên Đán 🧧', description: 'Hoa mai rơi, đèn lồng đỏ, chữ Phúc',
        emoji: '🧧', particles: ['🌸', '🏮', '🧧', '✨', '🎋'],
        accentColor: '#DC2626',
    },
    {
        id: 'valentine', name: 'Valentine 💕', description: 'Tim bay lơ lửng, hoa hồng',
        emoji: '💕', particles: ['❤️', '💕', '💖', '🌹', '💗'],
        accentColor: '#EC4899',
    },
    {
        id: 'women', name: 'Quốc tế Phụ nữ 🌸', description: 'Hoa anh đào, cánh hoa rơi nhẹ',
        emoji: '🌸', particles: ['🌸', '🌺', '🌷', '💐', '🌹'],
        accentColor: '#A855F7',
    },
    {
        id: 'mid-autumn', name: 'Trung Thu 🥮', description: 'Đèn lồng, trăng, ngôi sao',
        emoji: '🥮', particles: ['🏮', '🌕', '⭐', '🥮', '✨'],
        accentColor: '#D97706',
    },
    {
        id: 'halloween', name: 'Halloween 🎃', description: 'Dơi bay, bí ngô, mạng nhện',
        emoji: '🎃', particles: ['🎃', '🦇', '👻', '🕸️', '💀'],
        accentColor: '#F97316',
    },
    {
        id: 'christmas', name: 'Giáng Sinh 🎄', description: 'Tuyết rơi, cây thông, đèn Christmas',
        emoji: '🎄', particles: ['❄️', '🎄', '🎅', '⭐', '🎁'],
        accentColor: '#16A34A',
    },
    {
        id: 'newyear', name: 'Năm Mới 🎉', description: 'Confetti, pháo hoa, sao lấp lánh',
        emoji: '🎉', particles: ['🎉', '🎊', '🎆', '✨', '🥂'],
        accentColor: '#CA8A04',
    },
    {
        id: 'winter', name: 'Mùa Đông ❄️', description: 'Tuyết rơi nhẹ nhàng',
        emoji: '❄️', particles: ['❄️', '❅', '❆', '✨', '🌨️'],
        accentColor: '#0EA5E9',
    },
    {
        id: 'summer', name: 'Mùa Hè ☀️', description: 'Bong bóng, tia nắng',
        emoji: '☀️', particles: ['☀️', '🌊', '🐚', '🌴', '🏖️'],
        accentColor: '#EA580C',
    },
];

// Auto-date mapping for decorations
export const decorationAutoSchedule = [
    { decorationId: 'tet', startMonth: 1, startDay: 15, endMonth: 2, endDay: 15 },
    { decorationId: 'valentine', startMonth: 2, startDay: 10, endMonth: 2, endDay: 20 },
    { decorationId: 'women', startMonth: 3, startDay: 5, endMonth: 3, endDay: 12 },
    { decorationId: 'mid-autumn', startMonth: 9, startDay: 10, endMonth: 9, endDay: 25 },
    { decorationId: 'halloween', startMonth: 10, startDay: 25, endMonth: 11, endDay: 3 },
    { decorationId: 'christmas', startMonth: 12, startDay: 20, endMonth: 12, endDay: 31 },
    { decorationId: 'newyear', startMonth: 12, startDay: 28, endMonth: 1, endDay: 5 },
    { decorationId: 'winter', startMonth: 11, startDay: 15, endMonth: 2, endDay: 14 },
    { decorationId: 'summer', startMonth: 5, startDay: 15, endMonth: 8, endDay: 31 },
];

function getAutoDecorationId(): string | null {
    const now = new Date();
    const month = now.getMonth() + 1;
    const day = now.getDate();
    for (const s of decorationAutoSchedule) {
        if (s.startMonth <= s.endMonth) {
            if ((month > s.startMonth || (month === s.startMonth && day >= s.startDay)) &&
                (month < s.endMonth || (month === s.endMonth && day <= s.endDay))) return s.decorationId;
        } else {
            if ((month > s.startMonth || (month === s.startMonth && day >= s.startDay)) ||
                (month < s.endMonth || (month === s.endMonth && day <= s.endDay))) return s.decorationId;
        }
    }
    return null;
}

// ============================================================
// CONTEXT
// ============================================================
interface ThemeCtx {
    themeId: string;
    setThemeId: (id: string) => void;
    decorationId: string;
    setDecorationId: (id: string) => void;
    autoSwitch: boolean;
    setAutoSwitch: (v: boolean) => void;
}

const ThemeContext = createContext<ThemeCtx>({
    themeId: 'default',
    setThemeId: () => { },
    decorationId: 'none',
    setDecorationId: () => { },
    autoSwitch: false,
    setAutoSwitch: () => { },
});

export function useTheme() { return useContext(ThemeContext); }

function applyThemeToDOM(themeId: string) {
    const theme = allThemes.find(t => t.id === themeId) || allThemes[0];
    const root = document.documentElement;
    for (const [key, value] of Object.entries(theme.colors)) {
        root.style.setProperty(key, value);
    }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
    const [themeId, setThemeIdState] = useState('default');
    const [decorationId, setDecorationIdState] = useState('none');
    const [autoSwitch, setAutoSwitchState] = useState(false);

    useEffect(() => {
        const savedTheme = localStorage.getItem('ctn_theme') || 'default';
        const savedDecor = localStorage.getItem('ctn_decoration') || 'none';
        const savedAuto = localStorage.getItem('ctn_auto_theme') === 'true';

        // Apply base theme
        setThemeIdState(savedTheme);
        applyThemeToDOM(savedTheme);

        // Apply decoration
        if (savedAuto) {
            const autoDecor = getAutoDecorationId();
            setDecorationIdState(autoDecor || savedDecor);
        } else {
            setDecorationIdState(savedDecor);
        }
        setAutoSwitchState(savedAuto);
    }, []);

    const setThemeId = (id: string) => {
        setThemeIdState(id);
        localStorage.setItem('ctn_theme', id);
        applyThemeToDOM(id);
    };

    const setDecorationId = (id: string) => {
        setDecorationIdState(id);
        localStorage.setItem('ctn_decoration', id);
    };

    const setAutoSwitch = (v: boolean) => {
        setAutoSwitchState(v);
        localStorage.setItem('ctn_auto_theme', String(v));
        if (v) {
            const autoDecor = getAutoDecorationId();
            if (autoDecor) setDecorationId(autoDecor);
        }
    };

    return (
        <ThemeContext.Provider value={{ themeId, setThemeId, decorationId, setDecorationId, autoSwitch, setAutoSwitch }}>
            {children}
        </ThemeContext.Provider>
    );
}
