/**
 * Platform Settings — Quản lý cài đặt nền tảng bằng Prisma DB
 * Đã migrate từ file JSON sang Prisma Setting model
 */
import prisma from '@/lib/prisma';

export interface AdminPlatformSettings {
    commissionRate: number;      // % phí sàn  
    withdrawalFee: number;       // Phí rút tiền cố định (VNĐ)
    minWithdraw: number;         // Rút tối thiểu
    minDeposit: number;          // Nạp tối thiểu
    bankName: string;            // Ngân hàng nhận nạp
    bankAccount: string;         // STK nhận nạp
    bankOwner: string;           // Chủ tài khoản
    platformTotalEarnings: number;
    taxEnabled?: boolean;        // Bật/tắt thuế GTGT
    vatRate?: number;            // % thuế GTGT
}

const DEFAULT_SETTINGS: AdminPlatformSettings = {
    commissionRate: 5,
    withdrawalFee: 15000,
    minWithdraw: 500000,
    minDeposit: 2000,
    bankName: 'MB Bank',
    bankAccount: '0393959643',
    bankOwner: 'NGUYEN TAI DAT',
    platformTotalEarnings: 0,
    taxEnabled: false,
    vatRate: 10,
};

// In-memory cache with TTL
let cachedSettings: AdminPlatformSettings | null = null;
let cacheTime = 0;
const CACHE_TTL = 30_000; // 30 seconds

/**
 * Get platform settings from Prisma Setting table (cached)
 */
export function getPlatformSettings(): AdminPlatformSettings {
    // Return cached if fresh
    if (cachedSettings && Date.now() - cacheTime < CACHE_TTL) {
        return { ...cachedSettings };
    }
    // Return defaults synchronously, refresh cache async
    refreshSettingsCache();
    return { ...(cachedSettings || DEFAULT_SETTINGS) };
}

/**
 * Async version — use in API routes for guaranteed fresh data
 */
export async function getPlatformSettingsAsync(): Promise<AdminPlatformSettings> {
    try {
        const record = await prisma.setting.findUnique({ where: { key: 'platform_settings' } });
        if (record) {
            const parsed = JSON.parse(record.value) as Partial<AdminPlatformSettings>;
            cachedSettings = { ...DEFAULT_SETTINGS, ...parsed } as AdminPlatformSettings;
            cacheTime = Date.now();
            return { ...cachedSettings };
        }
    } catch (e) {
        console.error('[PlatformSettings] DB read error:', e);
    }
    return { ...DEFAULT_SETTINGS };
}

/**
 * Update platform settings in Prisma DB
 */
export async function updatePlatformSettings(updates: Partial<AdminPlatformSettings>): Promise<AdminPlatformSettings> {
    try {
        const current = await getPlatformSettingsAsync();
        const merged = { ...current, ...updates };

        await prisma.setting.upsert({
            where: { key: 'platform_settings' },
            update: { value: JSON.stringify(merged) },
            create: { key: 'platform_settings', value: JSON.stringify(merged), type: 'json', group: 'platform' },
        });

        cachedSettings = merged;
        cacheTime = Date.now();
        return { ...merged };
    } catch (e) {
        console.error('[PlatformSettings] DB write error:', e);
        // Fallback: update in-memory only
        cachedSettings = { ...(cachedSettings || DEFAULT_SETTINGS), ...updates };
        return { ...cachedSettings };
    }
}

/**
 * Background cache refresh (non-blocking)
 */
function refreshSettingsCache() {
    getPlatformSettingsAsync().catch(() => {});
}

// ==================== LEGACY EXPORTS (kept for backward compat, now use Prisma) ====================

/** @deprecated Use Prisma order queries directly */
export function getUserOrders(userId: string) { return []; }

/** @deprecated Use Prisma wallet queries directly */
export function getUserTransactions(userId: string) { return []; }

/** @deprecated Use Prisma wallet queries directly */
export function getUserBalance(userId: string) { return 0; }

/** @deprecated Use Prisma queries directly */
export function getPlatformStats() {
    return {
        totalOrders: 0,
        totalRevenue: 0,
        totalPlatformFees: 0,
        totalSellerEarnings: 0,
        pendingOrders: 0,
        completedOrders: 0,
        commissionRate: (cachedSettings || DEFAULT_SETTINGS).commissionRate,
    };
}

/** @deprecated No longer needed */
export function getAllOrders() { return []; }

/** @deprecated No longer needed */  
export function getAllTransactions() { return []; }
