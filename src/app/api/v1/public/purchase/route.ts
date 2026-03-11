import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey } from '@/lib/api-keys';
import { products } from '@/lib/mock-data';
import { findMockUserByUsername, getAllMockUsers } from '@/lib/mock-auth';

/**
 * Public API — Purchase
 * Auth: API Key via x-api-key header
 * 
 * POST /api/v1/public/purchase
 * Body: { productId, quantity? }
 * 
 * Deducts from wallet, returns purchased items (keys/accounts)
 */

// Mock stock items (in production, this would be in DB)
const stockItems: Record<string, string[]> = {
    'prod-1': ['netflix_acc_01@gmail.com:Pass123', 'netflix_acc_02@gmail.com:Pass456', 'netflix_acc_03@gmail.com:Pass789'],
    'prod-2': ['spotify_key_ABC123', 'spotify_key_DEF456', 'spotify_key_GHI789'],
    'prod-3': ['canva_pro_01@mail.com:Pro2026', 'canva_pro_02@mail.com:Pro2026'],
    'prod-4': ['chatgpt_plus_key_001', 'chatgpt_plus_key_002'],
};

// Order history (in-memory)
interface Order {
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

const orders: Order[] = [];

export function getOrdersByUserId(userId: string): Order[] {
    return orders.filter(o => o.userId === userId);
}

export async function POST(req: NextRequest) {
    // Validate API key
    const apiKey = req.headers.get('x-api-key');
    if (!apiKey) {
        return NextResponse.json({
            success: false,
            message: 'API Key required via x-api-key header',
            example: 'curl -H "x-api-key: YOUR_KEY" -X POST ...',
        }, { status: 401 });
    }

    const keyData = validateApiKey(apiKey);
    if (!keyData) {
        return NextResponse.json({ success: false, message: 'Invalid or revoked API Key' }, { status: 403 });
    }

    if (!keyData.permissions.includes('purchase')) {
        return NextResponse.json({ success: false, message: 'Permission denied: purchase required' }, { status: 403 });
    }

    const body = await req.json();
    const { productId, quantity = 1 } = body;

    if (!productId) {
        return NextResponse.json({ success: false, message: 'productId is required' }, { status: 400 });
    }

    if (quantity < 1 || quantity > 10) {
        return NextResponse.json({ success: false, message: 'quantity must be between 1 and 10' }, { status: 400 });
    }

    // Find product
    const product = products.find(p => p.id === productId);
    if (!product) {
        return NextResponse.json({ success: false, message: 'Product not found' }, { status: 404 });
    }

    // Check stock
    const stock = stockItems[productId] || [];
    if (stock.length < quantity) {
        return NextResponse.json({
            success: false,
            message: `Không đủ hàng. Còn lại: ${stock.length}`,
            available: stock.length,
        }, { status: 400 });
    }

    // Check balance
    const totalPrice = product.price * quantity;
    const allUsers = getAllMockUsers();
    const user = allUsers.find(u => u.id === keyData.userId);
    if (!user) {
        return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 });
    }

    if ((user.walletBalance || 0) < totalPrice) {
        return NextResponse.json({
            success: false,
            message: `Số dư không đủ. Cần ${totalPrice.toLocaleString('vi-VN')}đ, hiện có ${(user.walletBalance || 0).toLocaleString('vi-VN')}đ`,
            required: totalPrice,
            balance: user.walletBalance || 0,
        }, { status: 400 });
    }

    // Process purchase
    const purchasedItems = stock.splice(0, quantity);
    user.walletBalance = (user.walletBalance || 0) - totalPrice;

    // Create order
    const order: Order = {
        id: `ORD-${Date.now().toString(36).toUpperCase()}`,
        userId: keyData.userId,
        productId,
        productName: product.name,
        quantity,
        totalPrice,
        items: purchasedItems,
        status: 'COMPLETED',
        createdAt: new Date().toISOString(),
        apiKeyId: keyData.id,
    };
    orders.push(order);

    return NextResponse.json({
        success: true,
        message: `Mua thành công ${quantity}x ${product.name}`,
        data: {
            orderId: order.id,
            product: product.name,
            quantity,
            totalPrice,
            items: purchasedItems,
            balanceAfter: user.walletBalance,
        },
    });
}
