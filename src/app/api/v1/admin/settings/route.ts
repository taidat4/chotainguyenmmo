import { NextRequest, NextResponse } from 'next/server';
import { getPlatformSettings, updatePlatformSettings, getPlatformStats, getAllOrders, getAllTransactions } from '@/lib/mock-order-store';

// GET /api/v1/admin/settings — Get platform settings & stats
export async function GET() {
    try {
        const settings = getPlatformSettings();
        const stats = getPlatformStats();

        return NextResponse.json({
            success: true,
            data: { settings, stats },
        });
    } catch (error) {
        console.error('Get admin settings error:', error);
        return NextResponse.json({ success: false, message: 'Lỗi hệ thống' }, { status: 500 });
    }
}

// PUT /api/v1/admin/settings — Update platform settings
export async function PUT(request: NextRequest) {
    try {
        const body = await request.json();

        // Validate commission rate
        if (body.commissionRate !== undefined) {
            const rate = Number(body.commissionRate);
            if (isNaN(rate) || rate < 0 || rate > 50) {
                return NextResponse.json({ success: false, message: 'Phí sàn phải từ 0% đến 50%' }, { status: 400 });
            }
            body.commissionRate = rate;
        }

        const updated = updatePlatformSettings(body);

        return NextResponse.json({
            success: true,
            message: 'Đã cập nhật cài đặt thành công',
            data: updated,
        });
    } catch (error) {
        console.error('Update admin settings error:', error);
        return NextResponse.json({ success: false, message: 'Lỗi hệ thống' }, { status: 500 });
    }
}
