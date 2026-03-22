'use client';

import { User, Mail, Phone, MapPin, Calendar, Camera, Save } from 'lucide-react';
import { useI18n } from '@/lib/i18n';

export default function ProfilePage() {
    const { t } = useI18n();
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-xl font-bold text-brand-text-primary mb-1">{t('profileTitle')}</h1>
                <p className="text-sm text-brand-text-muted">{t('profileSubtitle')}</p>
            </div>

            {/* Avatar Section */}
            <div className="card flex flex-col sm:flex-row items-center gap-6">
                <div className="relative">
                    <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-brand-primary to-brand-secondary flex items-center justify-center">
                        <span className="text-white text-3xl font-bold">--</span>
                    </div>
                    <button className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full bg-brand-primary flex items-center justify-center text-white hover:brightness-110 transition-all shadow-lg">
                        <Camera className="w-4 h-4" />
                    </button>
                </div>
                <div className="text-center sm:text-left">
                    <h2 className="text-lg font-semibold text-brand-text-primary">{t('profileNotUpdated')}</h2>
                    <p className="text-sm text-brand-text-muted">{t('profileNewMember')}</p>
                    <div className="flex items-center gap-2 mt-2 justify-center sm:justify-start">
                        <span className="badge-success">{t('profileVerified')}</span>
                        <span className="badge-primary">{t('profileBuyer')}</span>
                    </div>
                </div>
            </div>

            {/* Personal Info */}
            <div className="card">
                <h3 className="text-sm font-semibold text-brand-text-primary mb-5">{t('profilePersonalInfo')}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                        <label className="block text-sm font-medium text-brand-text-primary mb-2">{t('profileFullName')}</label>
                        <div className="relative">
                            <User className="w-4 h-4 text-brand-text-muted absolute left-4 top-1/2 -translate-y-1/2" />
                            <input type="text" defaultValue="" placeholder={t('profileFullNamePlaceholder')} className="input-field !pl-11" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-brand-text-primary mb-2">{t('profileEmail')}</label>
                        <div className="relative">
                            <Mail className="w-4 h-4 text-brand-text-muted absolute left-4 top-1/2 -translate-y-1/2" />
                            <input type="email" defaultValue="" placeholder={t('profileEmailPlaceholder')} className="input-field !pl-11" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-brand-text-primary mb-2">{t('profilePhone')}</label>
                        <div className="relative">
                            <Phone className="w-4 h-4 text-brand-text-muted absolute left-4 top-1/2 -translate-y-1/2" />
                            <input type="tel" defaultValue="" placeholder={t('profilePhonePlaceholder')} className="input-field !pl-11" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-brand-text-primary mb-2">{t('profileAddress')}</label>
                        <div className="relative">
                            <MapPin className="w-4 h-4 text-brand-text-muted absolute left-4 top-1/2 -translate-y-1/2" />
                            <input type="text" defaultValue="" placeholder={t('profileAddressPlaceholder')} className="input-field !pl-11" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-brand-text-primary mb-2">{t('profileBirthday')}</label>
                        <div className="relative">
                            <Calendar className="w-4 h-4 text-brand-text-muted absolute left-4 top-1/2 -translate-y-1/2" />
                            <input type="date" defaultValue="" className="input-field !pl-11" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-brand-text-primary mb-2">{t('profileGender')}</label>
                        <select className="input-field">
                            <option>{t('profileMale')}</option>
                            <option>{t('profileFemale')}</option>
                            <option>{t('profileOther')}</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Account Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                    { label: t('profileTotalOrders'), value: '0' },
                    { label: t('profileOrdersDone'), value: '0' },
                    { label: t('profileTotalSpent'), value: '0đ' },
                    { label: t('profileFavorites'), value: '0' },
                ].map((stat, i) => (
                    <div key={i} className="card !p-4 text-center">
                        <div className="text-lg font-bold text-brand-text-primary">{stat.value}</div>
                        <div className="text-xs text-brand-text-muted mt-1">{stat.label}</div>
                    </div>
                ))}
            </div>

            {/* Save Button */}
            <div className="flex justify-end">
                <button className="btn-primary flex items-center gap-2">
                    <Save className="w-4 h-4" /> {t('profileSave')}
                </button>
            </div>
        </div>
    );
}
