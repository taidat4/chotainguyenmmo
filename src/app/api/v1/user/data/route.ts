import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { getUserOrders, getUserTransactions, getUserBalance } from '@/lib/mock-order-store';

export async function GET(request: NextRequest) {
    try {
        const token = request.cookies.get('token')?.value ||
            request.headers.get('authorization')?.replace('Bearer ', '');

        if (!token) {
            return NextResponse.json({ success: false, message: 'Vui lòng đăng nhập' }, { status: 401 });
        }

        const payload = await verifyToken(token);
        if (!payload || !payload.userId) {
            return NextResponse.json({ success: false, message: 'Phiên đăng nhập hết hạn' }, { status: 401 });
        }

        const userId = payload.userId as string;
        const { searchParams } = new URL(request.url);
        const type = searchParams.get('type'); // 'orders' | 'transactions' | 'balance'

        if (type === 'transactions') {
            return NextResponse.json({ success: true, data: getUserTransactions(userId) });
        }

        if (type === 'balance') {
            return NextResponse.json({ success: true, data: { balance: getUserBalance(userId) } });
        }

        // Default: return orders
        return NextResponse.json({ success: true, data: getUserOrders(userId) });
    } catch (error) {
        console.error('User data error:', error);
        return NextResponse.json({ success: false, message: 'Có lỗi xảy ra' }, { status: 500 });
    }
}
