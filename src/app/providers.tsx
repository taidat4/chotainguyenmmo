'use client';

import { AuthProvider } from '@/lib/auth-context';
import { ThemeProvider } from '@/lib/theme-provider';
import ThemeDecorations from '@/components/shared/ThemeDecorations';

export function Providers({ children }: { children: React.ReactNode }) {
    return (
        <ThemeProvider>
            <AuthProvider>
                {children}
            </AuthProvider>
            <ThemeDecorations />
        </ThemeProvider>
    );
}
