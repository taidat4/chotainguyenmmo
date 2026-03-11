/**
 * Seller Store — Manages shop registrations, KYC status, and admin settings
 * 
 * Uses JSON file persistence so data survives dev server hot-reloads.
 * 
 * Admin KYC Toggle:
 * - OFF (default): Sellers only need shop name + bank account (easy onboarding)
 * - ON: Full KYC required (CCCD, photos, address). ALL shops must complete KYC.
 */

import fs from 'fs';
import path from 'path';

export interface SellerApplication {
    id: string;
    userId: string;
    username: string;
    userEmail: string;
    // Shop info (always required)
    shopName: string;
    // KYC info (only required when kycRequired=true)
    kycFullName?: string;
    kycCccd?: string;
    kycPhone?: string;
    kycAddress?: string;
    kycFrontImage?: string;  // URL to uploaded image
    kycBackImage?: string;
    // Bank info (always required)
    bankName: string;
    bankAccount: string;
    bankOwner: string;
    // Status
    status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'KYC_REQUIRED';
    kycCompleted: boolean;
    rejectionReason?: string;
    createdAt: string;
    reviewedAt?: string;
    reviewedBy?: string;
}

// Admin settings
interface AdminSettings {
    kycRequired: boolean;           // Master toggle
    autoApprove: boolean;           // Auto-approve new applications
    autoApproveWhenKycOff: boolean; // Auto-approve when KYC is off
}

// ==================== FILE PERSISTENCE ====================
const DATA_DIR = path.join(process.cwd(), 'data');
const APPS_FILE = path.join(DATA_DIR, 'seller-applications.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'seller-settings.json');

function ensureDataDir() {
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }
}

function loadApplications(): SellerApplication[] {
    try {
        ensureDataDir();
        if (fs.existsSync(APPS_FILE)) {
            const raw = fs.readFileSync(APPS_FILE, 'utf-8');
            return JSON.parse(raw);
        }
    } catch (e) {
        console.error('Failed to load seller applications:', e);
    }
    return [];
}

function saveApplications(apps: SellerApplication[]) {
    try {
        ensureDataDir();
        fs.writeFileSync(APPS_FILE, JSON.stringify(apps, null, 2), 'utf-8');
    } catch (e) {
        console.error('Failed to save seller applications:', e);
    }
}

function loadSettings(): AdminSettings {
    try {
        ensureDataDir();
        if (fs.existsSync(SETTINGS_FILE)) {
            const raw = fs.readFileSync(SETTINGS_FILE, 'utf-8');
            return JSON.parse(raw);
        }
    } catch (e) {
        console.error('Failed to load seller settings:', e);
    }
    return {
        kycRequired: false,
        autoApprove: false,
        autoApproveWhenKycOff: false,
    };
}

function saveSettings(settings: AdminSettings) {
    try {
        ensureDataDir();
        fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf-8');
    } catch (e) {
        console.error('Failed to save seller settings:', e);
    }
}

// Initialize from files
let adminSettings: AdminSettings = loadSettings();
let applications: SellerApplication[] = loadApplications();

// ==================== ADMIN SETTINGS ====================

export function getAdminSettings(): AdminSettings {
    return { ...adminSettings };
}

export function updateAdminSettings(updates: Partial<AdminSettings>): AdminSettings {
    adminSettings = { ...adminSettings, ...updates };

    // When KYC is turned ON, mark all approved shops without KYC as KYC_REQUIRED
    if (updates.kycRequired === true) {
        applications.forEach(app => {
            if (app.status === 'APPROVED' && !app.kycCompleted) {
                app.status = 'KYC_REQUIRED';
            }
        });
    }
    // When KYC is turned OFF, re-approve shops that were KYC_REQUIRED
    if (updates.kycRequired === false) {
        applications.forEach(app => {
            if (app.status === 'KYC_REQUIRED') {
                app.status = 'APPROVED';
            }
        });
    }

    saveSettings(adminSettings);
    saveApplications(applications);
    return adminSettings;
}

// ==================== APPLICATION CRUD ====================

export function createApplication(data: {
    userId: string;
    username: string;
    userEmail: string;
    shopName: string;
    bankName: string;
    bankAccount: string;
    bankOwner: string;
    // KYC fields (optional when KYC is off)
    kycFullName?: string;
    kycCccd?: string;
    kycPhone?: string;
    kycAddress?: string;
}): SellerApplication {
    // Check if user already has an application
    const existing = applications.find(a => a.userId === data.userId);
    if (existing && (existing.status === 'APPROVED' || existing.status === 'PENDING')) {
        throw new Error('Bạn đã có đơn đăng ký. Vui lòng chờ duyệt hoặc liên hệ admin.');
    }

    const kycOff = !adminSettings.kycRequired;
    const kycCompleted = kycOff ? true : !!(data.kycFullName && data.kycCccd && data.kycPhone);

    const app: SellerApplication = {
        id: `app_${Date.now()}`,
        userId: data.userId,
        username: data.username,
        userEmail: data.userEmail,
        shopName: data.shopName,
        kycFullName: data.kycFullName,
        kycCccd: data.kycCccd,
        kycPhone: data.kycPhone,
        kycAddress: data.kycAddress,
        bankName: data.bankName,
        bankAccount: data.bankAccount,
        bankOwner: data.bankOwner,
        status: 'PENDING',
        kycCompleted,
        createdAt: new Date().toISOString(),
    };

    // Auto-approve logic
    if (kycOff && adminSettings.autoApproveWhenKycOff) {
        app.status = 'APPROVED';
        app.reviewedAt = new Date().toISOString();
        app.reviewedBy = 'AUTO';
    } else if (adminSettings.autoApprove) {
        app.status = 'APPROVED';
        app.reviewedAt = new Date().toISOString();
        app.reviewedBy = 'AUTO';
    }

    // Remove old rejected application if exists
    const rejectedIdx = applications.findIndex(a => a.userId === data.userId && a.status === 'REJECTED');
    if (rejectedIdx >= 0) applications.splice(rejectedIdx, 1);

    applications.push(app);
    saveApplications(applications);
    return app;
}

export function getApplicationByUser(userId: string): SellerApplication | null {
    return applications.find(a => a.userId === userId) || null;
}

export function getAllApplications(): SellerApplication[] {
    return [...applications].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function getPendingApplications(): SellerApplication[] {
    return applications.filter(a => a.status === 'PENDING');
}

export function reviewApplication(appId: string, action: 'APPROVED' | 'REJECTED', reviewedBy: string, reason?: string): boolean {
    const app = applications.find(a => a.id === appId);
    if (!app) return false;

    app.status = action;
    app.reviewedAt = new Date().toISOString();
    app.reviewedBy = reviewedBy;
    if (reason) app.rejectionReason = reason;

    saveApplications(applications);
    return true;
}

// Delete an application completely
export function deleteApplication(appId: string): boolean {
    const idx = applications.findIndex(a => a.id === appId);
    if (idx < 0) return false;
    applications.splice(idx, 1);
    saveApplications(applications);
    return true;
}

export function submitKycForApp(appId: string, kycData: {
    kycFullName: string;
    kycCccd: string;
    kycPhone: string;
    kycAddress?: string;
}): boolean {
    const app = applications.find(a => a.id === appId);
    if (!app) return false;

    app.kycFullName = kycData.kycFullName;
    app.kycCccd = kycData.kycCccd;
    app.kycPhone = kycData.kycPhone;
    app.kycAddress = kycData.kycAddress;
    app.kycCompleted = true;

    // If status was KYC_REQUIRED, move to PENDING for review
    if (app.status === 'KYC_REQUIRED') {
        app.status = 'PENDING';
    }

    saveApplications(applications);
    return true;
}

// Check if user is an active seller
export function isActiveSeller(userId: string): boolean {
    const app = getApplicationByUser(userId);
    return app?.status === 'APPROVED';
}

// Check if user needs KYC
export function needsKyc(userId: string): boolean {
    const app = getApplicationByUser(userId);
    if (!app) return false;
    return app.status === 'KYC_REQUIRED' || (adminSettings.kycRequired && !app.kycCompleted);
}
