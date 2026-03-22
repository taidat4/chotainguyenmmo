'use client';

import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import { Shield, FileText, CreditCard, AlertTriangle } from 'lucide-react';
import { useI18n } from '@/lib/i18n';

export default function PoliciesPage() {
    const { t } = useI18n();

    const policies = [
        {
            icon: FileText,
            titleKey: 'policyTos' as const,
            sectionKeys: ['policyTos1', 'policyTos2', 'policyTos3', 'policyTos4', 'policyTos5'] as const,
        },
        {
            icon: Shield,
            titleKey: 'policyPrivacy' as const,
            sectionKeys: ['policyPrivacy1', 'policyPrivacy2', 'policyPrivacy3', 'policyPrivacy4'] as const,
        },
        {
            icon: CreditCard,
            titleKey: 'policyRefund' as const,
            sectionKeys: ['policyRefund1', 'policyRefund2', 'policyRefund3', 'policyRefund4'] as const,
        },
        {
            icon: AlertTriangle,
            titleKey: 'policySeller' as const,
            sectionKeys: ['policySeller1', 'policySeller2', 'policySeller3', 'policySeller4', 'policySeller5', 'policySeller6'] as const,
        },
    ];

    return (
        <>
            <Header />
            <main className="min-h-screen bg-brand-bg py-12">
                <div className="max-w-4xl mx-auto px-6">
                    <h1 className="text-3xl font-bold text-brand-text-primary mb-2">{t('policyTitle')}</h1>
                    <p className="text-brand-text-secondary mb-10">{t('policyUpdated')}</p>

                    <div className="space-y-8">
                        {policies.map((p, i) => (
                            <div key={i} className="card">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="w-10 h-10 rounded-xl bg-brand-primary/10 flex items-center justify-center">
                                        <p.icon className="w-5 h-5 text-brand-primary" />
                                    </div>
                                    <h2 className="text-lg font-semibold text-brand-text-primary">{t(p.titleKey)}</h2>
                                </div>
                                <ul className="space-y-3">
                                    {p.sectionKeys.map((key, j) => (
                                        <li key={j} className="flex items-start gap-3 text-sm text-brand-text-secondary">
                                            <span className="text-brand-primary mt-1 shrink-0">•</span>
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
