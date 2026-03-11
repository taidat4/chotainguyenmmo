import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { createPurchase, getUserBalance } from '@/lib/mock-order-store';

export async function POST(request: NextRequest) {
    try {
        // Verify auth
        const token = request.cookies.get('token')?.value ||
            request.headers.get('authorization')?.replace('Bearer ', '');

        if (!token) {
            return NextResponse.json({ success: false, message: 'Vui lòng đăng nhập', errorCode: 'UNAUTHORIZED' }, { status: 401 });
        }

        const payload = await verifyToken(token);
        if (!payload || !payload.userId) {
            return NextResponse.json({ success: false, message: 'Phiên đăng nhập hết hạn', errorCode: 'UNAUTHORIZED' }, { status: 401 });
        }

        const body = await request.json();
        const { productId, quantity = 1 } = body;

        if (!productId) {
            return NextResponse.json({ success: false, message: 'Thiếu thông tin sản phẩm', errorCode: 'VALIDATION_ERROR' }, { status: 400 });
        }

        const result = createPurchase(payload.userId as string, productId, quantity);

        if (!result.success) {
            return NextResponse.json({ success: false, message: result.message }, { status: 400 });
        }

        return NextResponse.json({
            success: true,
            message: result.message,
            data: {
                order: result.order,
                newBalance: result.balance,
            },
        }, { status: 201 });
    } catch (error) {
        console.error('Purchase error:', error);
        return NextResponse.json({ success: false, message: 'Có lỗi xảy ra' }, { status: 500 });
    }
}
