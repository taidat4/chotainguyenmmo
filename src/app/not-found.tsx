'use client';

import Link from 'next/link';
import { Home, ArrowLeft, Search } from 'lucide-react';
import { useI18n } from '@/lib/i18n';

export default function NotFound() {
    const { t } = useI18n();
    return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-brand-bg">
            <div className="text-center max-w-md">
                <div className="text-8xl font-black text-brand-primary/20 mb-4">404</div>
                <h1 className="text-2xl font-bold text-brand-text-primary mb-2">{t('notFoundTitle')}</h1>
                <p className="text-sm text-brand-text-muted mb-8">{t('notFoundDesc')}</p>
                <div className="flex items-center gap-3 justify-center mb-6">
                    <Link href="/" className="btn-primary flex items-center gap-2 !py-2.5 !px-5 text-sm">
                        <Home className="w-4 h-4" /> {t('goHome')}
                    </Link>
                    <button onClick={() => window.history.back()} className="btn-secondary flex items-center gap-2 !py-2.5 !px-5 text-sm">
                        <ArrowLeft className="w-4 h-4" /> {t('goBack2')}
                    </button>
                </div>
                <p className="text-xs text-brand-text-muted mb-2">{t('trySearch')}</p>
                <div className="relative max-w-xs mx-auto">
                    <Search className="w-4 h-4 text-brand-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
                    <input type="text" placeholder={t('searchKeywordPlaceholder')} className="input-field !pl-10 text-sm" />
                </div>
            </div>
        </div>
    );
}
