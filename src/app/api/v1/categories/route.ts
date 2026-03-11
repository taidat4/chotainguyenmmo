import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// GET /api/v1/categories — Public category listing
export async function GET() {
    try {
        const categories = await prisma.category.findMany({
            where: { isActive: true },
            orderBy: { sortOrder: 'asc' },
            include: {
                children: {
                    where: { isActive: true },
                    orderBy: { sortOrder: 'asc' },
                },
                _count: { select: { products: { where: { status: 'ACTIVE' } } } },
            },
        });

        return NextResponse.json({ success: true, data: categories });
    } catch (error) {
        console.error('List categories error:', error);
        return NextResponse.json(
            { success: false, message: 'Lỗi hệ thống', errorCode: 'INTERNAL_ERROR' },
            { status: 500 }
        );
    }
}
