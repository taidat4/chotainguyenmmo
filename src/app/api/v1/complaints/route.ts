import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth, generateComplaintCode } from '@/lib/auth';

// POST /api/v1/complaints — Create complaint
export async function POST(request: NextRequest) {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    try {
        const { orderId, reason, summary } = await request.json();

        if (!orderId || !reason || !summary) {
            return NextResponse.json(
                { success: false, message: 'Vui lòng điền đầy đủ thông tin', errorCode: 'VALIDATION_ERROR' },
                { status: 400 }
            );
        }

        // Check order ownership
        const order = await prisma.order.findFirst({
            where: { id: orderId, buyerId: authResult.userId },
        });
        if (!order) {
            return NextResponse.json(
                { success: false, message: 'Không tìm thấy đơn hàng', errorCode: 'NOT_FOUND' },
                { status: 404 }
            );
        }

        // Check complaint window
        const windowHours = 48;
        const windowEnd = new Date(order.createdAt.getTime() + windowHours * 3600000);
        if (new Date() > windowEnd) {
            return NextResponse.json(
                { success: false, message: 'Đã quá thời hạn khiếu nại cho đơn hàng này', errorCode: 'WINDOW_EXPIRED' },
                { status: 400 }
            );
        }

        // Check existing complaint
        const existing = await prisma.complaint.findFirst({ where: { orderId } });
        if (existing) {
            return NextResponse.json(
                { success: false, message: 'Đã tồn tại khiếu nại cho đơn hàng này', errorCode: 'ALREADY_EXISTS' },
                { status: 409 }
            );
        }

        const complaint = await prisma.complaint.create({
            data: {
                complaintCode: generateComplaintCode(),
                orderId,
                buyerId: authResult.userId,
                shopId: order.shopId,
                reason: reason as any,
                status: 'OPEN',
                summary,
            },
        });

        return NextResponse.json({
            success: true,
            message: 'Khiếu nại đã được gửi',
            data: complaint,
        }, { status: 201 });
    } catch (error) {
        console.error('Create complaint error:', error);
        return NextResponse.json(
            { success: false, message: 'Lỗi hệ thống', errorCode: 'INTERNAL_ERROR' },
            { status: 500 }
        );
    }
}

// GET /api/v1/complaints — List user complaints
export async function GET(request: NextRequest) {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    try {
        const complaints = await prisma.complaint.findMany({
            where: { buyerId: authResult.userId },
            orderBy: { createdAt: 'desc' },
            include: {
                order: { select: { orderCode: true, totalAmount: true } },
                shop: { select: { name: true } },
                messages: { orderBy: { createdAt: 'asc' } },
            },
        });

        return NextResponse.json({ success: true, data: complaints });
    } catch (error) {
        console.error('List complaints error:', error);
        return NextResponse.json(
            { success: false, message: 'Lỗi hệ thống', errorCode: 'INTERNAL_ERROR' },
            { status: 500 }
        );
    }
}
