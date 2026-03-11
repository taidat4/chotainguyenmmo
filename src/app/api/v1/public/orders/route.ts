import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey } from '@/lib/api-keys';
import { getAllMockUsers } from '@/lib/mock-auth';
import { getOrdersByUserId } from '../purchase/route';

/**
 * Public API — Orders & Balance
 * Auth: API Key via x-api-key header
 * 
 * GET /api/v1/public/orders             — List orders
 * GET /api/v1/public/orders?type=balance — Check wallet balance
 */
export async function GET(req: NextRequest) {
    const apiKey = req.headers.get('x-api-key') || new URL(req.url).searchParams.get('api_key');
    if (!apiKey) {
        return NextResponse.json({ success: false, message: 'API Key required' }, { status: 401 });
    }

    const keyData = validateApiKey(apiKey);
    if (!keyData) {
        return NextResponse.json({ success: false, message: 'Invalid or revoked API Key' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type');

    // Balance check
    if (type === 'balance') {
        if (!keyData.permissions.includes('balance:read')) {
            return NextResponse.json({ success: false, message: 'Permission denied: balance:read' }, { status: 403 });
        }
        const allUsers = getAllMockUsers();
        const user = allUsers.find(u => u.id === keyData.userId);
        return NextResponse.json({
            success: true,
            data: {
                balance: user?.walletBalance || 0,
                currency: 'VND',
                username: keyData.username,
            },
        });
    }

    // Orders
    if (!keyData.permissions.includes('orders:read')) {
        return NextResponse.json({ success: false, message: 'Permission denied: orders:read' }, { status: 403 });
    }

    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);

    const allOrders = getOrdersByUserId(keyData.userId);
    const sorted = allOrders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const start = (page - 1) * limit;
    const paginated = sorted.slice(start, start + limit);

    return NextResponse.json({
        success: true,
        data: paginated.map(o => ({
            orderId: o.id,
            product: o.productName,
            quantity: o.quantity,
            totalPrice: o.totalPrice,
            items: o.items,
            status: o.status,
            createdAt: o.createdAt,
        })),
        pagination: {
            page,
            limit,
            total: allOrders.length,
            totalPages: Math.ceil(allOrders.length / limit),
        },
    });
}
