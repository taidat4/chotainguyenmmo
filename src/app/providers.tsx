'use client';

import { AuthProvider } from '@/lib/auth-context';
import { ThemeProvider } from '@/lib/theme-provider';
import ThemeDecorations from '@/components/shared/ThemeDecorations';
import AnnouncementPopup from '@/components/AnnouncementPopup';
import { UIProvider } from '@/components/shared/UIProvider';

export function Providers({ children }: { children: React.ReactNode }) {
    return (
        <ThemeProvider>
            <AuthProvider>
                <UIProvider>
                    {children}
                    <AnnouncementPopup />
                </UIProvider>
            </AuthProvider>
            <ThemeDecorations />
        </ThemeProvider>
    );
}
