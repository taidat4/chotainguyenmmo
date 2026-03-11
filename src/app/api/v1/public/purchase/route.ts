import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey } from '@/lib/api-keys';
import { products } from '@/lib/mock-data';
import { getAllMockUsers } from '@/lib/mock-auth';
import { stockItems, addApiOrder } from '@/lib/api-order-store';

/**
 * Public API — Purchase
 * Auth: API Key via x-api-key header
 * 
 * POST /api/v1/public/purchase
 * Body: { productId, quantity? }
 * 
 * Deducts from wallet, returns purchased items (keys/accounts)
 */

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
    const order = {
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
    addApiOrder(order);

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
