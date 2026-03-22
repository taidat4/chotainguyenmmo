'use client';

import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import { Search, ShoppingBag, Wallet, CreditCard, Package, AlertTriangle, Star, ArrowRight } from 'lucide-react';
import { useI18n } from '@/lib/i18n';

export default function GuidePage() {
    const { t } = useI18n();

    const steps = [
        { icon: Search, titleKey: 'guideStep1Title' as const, itemKeys: ['guideStep1a', 'guideStep1b', 'guideStep1c'] as const },
        { icon: Wallet, titleKey: 'guideStep2Title' as const, itemKeys: ['guideStep2a', 'guideStep2b', 'guideStep2c'] as const },
        { icon: ShoppingBag, titleKey: 'guideStep3Title' as const, itemKeys: ['guideStep3a', 'guideStep3b', 'guideStep3c'] as const },
        { icon: Package, titleKey: 'guideStep4Title' as const, itemKeys: ['guideStep4a', 'guideStep4b', 'guideStep4c'] as const },
        { icon: AlertTriangle, titleKey: 'guideStep5Title' as const, itemKeys: ['guideStep5a', 'guideStep5b', 'guideStep5c'] as const },
        { icon: Star, titleKey: 'guideStep6Title' as const, itemKeys: ['guideStep6a', 'guideStep6b'] as const },
    ];

    return (
        <>
            <Header />
            <main className="min-h-screen bg-brand-bg py-12">
                <div className="max-w-4xl mx-auto px-6">
                    <h1 className="text-3xl font-bold text-brand-text-primary mb-2">{t('guideTitle')}</h1>
                    <p className="text-brand-text-secondary mb-10">{t('guideSubtitle')}</p>

                    <div className="space-y-6">
                        {steps.map((step, i) => (
                            <div key={i} className="card">
                                <div className="flex items-center gap-4 mb-4">
                                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-primary to-brand-secondary flex items-center justify-center shrink-0">
                                        <span className="text-white font-bold">{i + 1}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <step.icon className="w-5 h-5 text-brand-primary" />
                                        <h2 className="text-lg font-semibold text-brand-text-primary">{t(step.titleKey)}</h2>
                                    </div>
                                </div>
                                <ul className="space-y-2 ml-14">
                                    {step.itemKeys.map((key, j) => (
                                        <li key={j} className="flex items-start gap-2 text-sm text-brand-text-secondary">
                                            <ArrowRight className="w-3 h-3 text-brand-primary mt-1 shrink-0" />
                                            {t(key)}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                    </div>
                </div>
            </main>
            <Footer />
        </>
    );
}
