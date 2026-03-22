'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { RefreshCw, Home, AlertTriangle } from 'lucide-react';
import { useI18n } from '@/lib/i18n';

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
    const { t } = useI18n();
    useEffect(() => { console.error(error); }, [error]);

    return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-brand-bg">
            <div className="text-center max-w-md">
                <div className="w-16 h-16 rounded-2xl bg-brand-danger/10 flex items-center justify-center mx-auto mb-4">
                    <AlertTriangle className="w-8 h-8 text-brand-danger" />
                </div>
                <h1 className="text-2xl font-bold text-brand-text-primary mb-2">{t('errorTitle')}</h1>
                <p className="text-sm text-brand-text-muted mb-6">{t('errorDesc')}</p>
                {error.message && (
                    <div className="bg-brand-surface-2 rounded-xl p-3 mb-6 text-left">
                        <p className="text-xs text-brand-text-muted mb-1 font-semibold">{t('errorDetail')}</p>
                        <p className="text-xs text-brand-danger font-mono">{error.message}</p>
                    </div>
                )}
                <div className="flex items-center gap-3 justify-center">
                    <button onClick={reset} className="btn-primary flex items-center gap-2 !py-2.5 !px-5 text-sm">
                        <RefreshCw className="w-4 h-4" /> {t('retry')}
                    </button>
                    <Link href="/" className="btn-secondary flex items-center gap-2 !py-2.5 !px-5 text-sm">
                        <Home className="w-4 h-4" /> {t('homepage')}
                    </Link>
                </div>
            </div>
        </div>
    );
}
