// Shared API order store — used by public purchase & orders routes

export interface ApiOrder {
    id: string;
    userId: string;
    productId: string;
    productName: string;
    quantity: number;
    totalPrice: number;
    items: string[];
    status: string;
    createdAt: string;
    apiKeyId: string;
}

// In-memory order store
const apiOrders: ApiOrder[] = [];

// Mock stock items (in production, this would be in DB)
export const stockItems: Record<string, string[]> = {
    'prod-1': ['netflix_acc_01@gmail.com:Pass123', 'netflix_acc_02@gmail.com:Pass456', 'netflix_acc_03@gmail.com:Pass789'],
    'prod-2': ['spotify_key_ABC123', 'spotify_key_DEF456', 'spotify_key_GHI789'],
    'prod-3': ['canva_pro_01@mail.com:Pro2026', 'canva_pro_02@mail.com:Pro2026'],
    'prod-4': ['chatgpt_plus_key_001', 'chatgpt_plus_key_002'],
};

export function addApiOrder(order: ApiOrder) {
    apiOrders.push(order);
}

export function getOrdersByUserId(userId: string): ApiOrder[] {
    return apiOrders.filter(o => o.userId === userId);
}
