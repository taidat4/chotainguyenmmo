/**
 * Google Sheets Sync System for Sellers
 * 
 * Each seller configures:
 * 1. Google Sheet URL
 * 2. Sheet tab mappings (which product → which tab/sheet name)
 * 3. Status rules (which status value = available, which = sold/do not pull)
 * 4. Column mapping (which columns contain the data)
 * 
 * The system:
 * - Only pulls items with "available" status
 * - Marks items as "sold" after purchase
 * - Tracks which items have been pulled
 * - Supports different tab names per product
 */

export interface SheetColumnMapping {
    dataColumn: string;        // Column containing the actual data (account/key), e.g. "A" or "A:C" for multi-column
    statusColumn: string;      // Column containing status, e.g. "D"
    startRow: number;          // First data row (skip header), e.g. 2
}

export interface SheetTabMapping {
    productId: string;         // Product ID on ChoTaiNguyen
    productName: string;       // Product name (for display)
    sheetTabName: string;      // Tab/sheet name in Google Sheets, e.g. "Netflix", "Spotify"
    columnMapping: SheetColumnMapping;
}

export interface SheetStatusConfig {
    availableValues: string[];  // Status values that mean "available for sale", e.g. ["Available", "Có sẵn", "OK", "ready"]
    soldValue: string;          // Value to write when item is sold, e.g. "Đã bán" or "SOLD"
    doNotPullValues: string[];  // Status values that mean NEVER pull, e.g. ["Đã bán", "SOLD", "Hết hạn", "Lỗi", "Reserved"]
}

export interface SellerSheetConfig {
    sellerId: string;
    sellerName: string;
    googleSheetUrl: string;
    googleSheetId: string;      // Extracted from URL
    statusConfig: SheetStatusConfig;
    tabMappings: SheetTabMapping[];
    isActive: boolean;
    lastSyncAt?: string;
    lastSyncStatus?: 'success' | 'error' | 'syncing';
    lastSyncMessage?: string;
    syncIntervalMinutes: number; // Default 5
    createdAt: string;
}

// In-memory store for seller sheet configs
const sellerSheetConfigs: SellerSheetConfig[] = [
    // Demo config
    {
        sellerId: 'user_seller',
        sellerName: 'Nguyễn Văn Tài',
        googleSheetUrl: 'https://docs.google.com/spreadsheets/d/1ABC_example_sheet_id/edit',
        googleSheetId: '1ABC_example_sheet_id',
        statusConfig: {
            availableValues: ['Available', 'Có sẵn', 'OK', 'ready', 'Còn hàng'],
            soldValue: 'Đã bán',
            doNotPullValues: ['Đã bán', 'SOLD', 'Hết hạn', 'Lỗi', 'Reserved', 'Đang xử lý'],
        },
        tabMappings: [
            {
                productId: 'prod-1',
                productName: 'Netflix Premium 1 Tháng',
                sheetTabName: 'Netflix',
                columnMapping: { dataColumn: 'A:C', statusColumn: 'D', startRow: 2 },
            },
            {
                productId: 'prod-2',
                productName: 'Spotify Premium 3 Tháng',
                sheetTabName: 'Spotify_Keys',
                columnMapping: { dataColumn: 'A', statusColumn: 'B', startRow: 2 },
            },
        ],
        isActive: true,
        lastSyncAt: new Date().toISOString(),
        lastSyncStatus: 'success',
        lastSyncMessage: 'Synced 45 items from Netflix, 23 items from Spotify_Keys',
        syncIntervalMinutes: 5,
        createdAt: new Date().toISOString(),
    },
];

// In-memory synced stock from Google Sheets
interface SyncedStockItem {
    id: string;           // Unique ID for this stock item
    sellerId: string;
    productId: string;
    sheetTabName: string;
    rowNumber: number;     // Row in the sheet (for marking as sold)
    data: string;          // The actual content (account/key/etc)
    status: string;        // Current status
    isPulled: boolean;     // Whether this item has been given to a customer
    pulledAt?: string;     // When it was pulled
    orderId?: string;      // Order that consumed this item
}

const syncedStock: SyncedStockItem[] = [
    // Demo stock items (simulating what would come from Google Sheets)
    { id: 'ss_1', sellerId: 'user_seller', productId: 'prod-1', sheetTabName: 'Netflix', rowNumber: 2, data: 'netflix_premium_01@gmail.com | Pass@2026 | Expires: 2026-04-10', status: 'Available', isPulled: false },
    { id: 'ss_2', sellerId: 'user_seller', productId: 'prod-1', sheetTabName: 'Netflix', rowNumber: 3, data: 'netflix_premium_02@gmail.com | Ultra@123 | Expires: 2026-05-01', status: 'Available', isPulled: false },
    { id: 'ss_3', sellerId: 'user_seller', productId: 'prod-1', sheetTabName: 'Netflix', rowNumber: 4, data: 'netflix_premium_03@gmail.com | Acc@789 | Expires: 2026-03-20', status: 'Đã bán', isPulled: true, pulledAt: '2026-03-09T10:00:00Z', orderId: 'ORD-ABC' },
    { id: 'ss_4', sellerId: 'user_seller', productId: 'prod-1', sheetTabName: 'Netflix', rowNumber: 5, data: 'netflix_premium_04@gmail.com | Key@456 | Expires: 2026-06-15', status: 'Available', isPulled: false },
    { id: 'ss_5', sellerId: 'user_seller', productId: 'prod-2', sheetTabName: 'Spotify_Keys', rowNumber: 2, data: 'SPOTIFY-KEY-ABC-123-DEF', status: 'Available', isPulled: false },
    { id: 'ss_6', sellerId: 'user_seller', productId: 'prod-2', sheetTabName: 'Spotify_Keys', rowNumber: 3, data: 'SPOTIFY-KEY-GHI-456-JKL', status: 'Available', isPulled: false },
    { id: 'ss_7', sellerId: 'user_seller', productId: 'prod-2', sheetTabName: 'Spotify_Keys', rowNumber: 4, data: 'SPOTIFY-KEY-MNO-789-PQR', status: 'Hết hạn', isPulled: false },
];

// ==================== CONFIG CRUD ====================

export function getSellerSheetConfig(sellerId: string): SellerSheetConfig | null {
    return sellerSheetConfigs.find(c => c.sellerId === sellerId) || null;
}

export function getAllSellerSheetConfigs(): SellerSheetConfig[] {
    return sellerSheetConfigs;
}

export function saveSellerSheetConfig(config: SellerSheetConfig): void {
    const idx = sellerSheetConfigs.findIndex(c => c.sellerId === config.sellerId);
    // Extract sheet ID from URL
    const match = config.googleSheetUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
    config.googleSheetId = match ? match[1] : '';

    if (idx >= 0) {
        sellerSheetConfigs[idx] = config;
    } else {
        sellerSheetConfigs.push(config);
    }
}

export function addTabMapping(sellerId: string, mapping: SheetTabMapping): boolean {
    const config = sellerSheetConfigs.find(c => c.sellerId === sellerId);
    if (!config) return false;
    // Replace if same productId exists
    const idx = config.tabMappings.findIndex(m => m.productId === mapping.productId);
    if (idx >= 0) {
        config.tabMappings[idx] = mapping;
    } else {
        config.tabMappings.push(mapping);
    }
    return true;
}

export function removeTabMapping(sellerId: string, productId: string): boolean {
    const config = sellerSheetConfigs.find(c => c.sellerId === sellerId);
    if (!config) return false;
    config.tabMappings = config.tabMappings.filter(m => m.productId !== productId);
    return true;
}

// ==================== STOCK OPERATIONS ====================

/**
 * Get available stock for a product (only items with available status that haven't been pulled)
 */
export function getAvailableStock(sellerId: string, productId: string): SyncedStockItem[] {
    const config = sellerSheetConfigs.find(c => c.sellerId === sellerId);
    if (!config) return [];

    const availableValues = config.statusConfig.availableValues.map(v => v.toLowerCase());

    return syncedStock.filter(item =>
        item.sellerId === sellerId &&
        item.productId === productId &&
        !item.isPulled &&
        availableValues.includes(item.status.toLowerCase())
    );
}

/**
 * Pull items from stock (mark as sold)
 * Returns the pulled items' data
 */
export function pullStockItems(sellerId: string, productId: string, quantity: number, orderId: string): string[] {
    const available = getAvailableStock(sellerId, productId);
    if (available.length < quantity) return [];

    const config = sellerSheetConfigs.find(c => c.sellerId === sellerId);
    const soldValue = config?.statusConfig.soldValue || 'Đã bán';

    const pulled: string[] = [];
    for (let i = 0; i < quantity && i < available.length; i++) {
        available[i].isPulled = true;
        available[i].pulledAt = new Date().toISOString();
        available[i].orderId = orderId;
        available[i].status = soldValue;
        pulled.push(available[i].data);
    }

    return pulled;
}

/**
 * Get stock summary for a seller (across all products)
 */
export function getStockSummary(sellerId: string): {
    productId: string;
    productName: string;
    sheetTabName: string;
    total: number;
    available: number;
    sold: number;
    doNotPull: number;
}[] {
    const config = sellerSheetConfigs.find(c => c.sellerId === sellerId);
    if (!config) return [];

    const availableValues = config.statusConfig.availableValues.map(v => v.toLowerCase());
    const doNotPullValues = config.statusConfig.doNotPullValues.map(v => v.toLowerCase());

    return config.tabMappings.map(mapping => {
        const items = syncedStock.filter(i => i.sellerId === sellerId && i.productId === mapping.productId);
        return {
            productId: mapping.productId,
            productName: mapping.productName,
            sheetTabName: mapping.sheetTabName,
            total: items.length,
            available: items.filter(i => !i.isPulled && availableValues.includes(i.status.toLowerCase())).length,
            sold: items.filter(i => i.isPulled).length,
            doNotPull: items.filter(i => !i.isPulled && doNotPullValues.includes(i.status.toLowerCase())).length,
        };
    });
}

/**
 * Get all stock items for a seller (for admin view)
 */
export function getAllStockItems(sellerId: string, productId?: string): SyncedStockItem[] {
    return syncedStock.filter(i =>
        i.sellerId === sellerId &&
        (!productId || i.productId === productId)
    );
}

// Default status config template
export const DEFAULT_STATUS_CONFIG: SheetStatusConfig = {
    availableValues: ['Available', 'Có sẵn', 'OK', 'Còn hàng', 'ready'],
    soldValue: 'Đã bán',
    doNotPullValues: ['Đã bán', 'SOLD', 'Hết hạn', 'Lỗi', 'Reserved', 'Đang xử lý', 'Expired', 'Error'],
};

// Default column mapping template
export const DEFAULT_COLUMN_MAPPING: SheetColumnMapping = {
    dataColumn: 'A:C',
    statusColumn: 'D',
    startRow: 2,
};
