import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import prisma from '@/lib/prisma';

/**
 * Seller Inventory API
 * GET  — List products with stock counts
 * POST — Upload stock items (paste text or file content)
 */

export async function GET(request: NextRequest) {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    try {
        const shop = await prisma.shop.findUnique({ where: { ownerId: authResult.userId } });
        if (!shop) {
            return NextResponse.json({ success: true, data: { products: [], stats: { total: 0, available: 0, used: 0, low: 0 } } });
        }

        const products = await prisma.product.findMany({
            where: { shopId: shop.id, status: { not: 'ARCHIVED' } },
            orderBy: { createdAt: 'desc' },
            include: {
                _count: {
                    select: {
                        stockItems: true,
                    },
                },
                stockItems: {
                    select: { status: true },
                },
                stockBatches: {
                    orderBy: { createdAt: 'desc' },
                    take: 1,
                    select: { createdAt: true },
                },
            },
        });

        const inventory = products.map(p => {
            const total = p.stockItems.length;
            const available = p.stockItems.filter(s => s.status === 'AVAILABLE').length;
            const sold = p.stockItems.filter(s => s.status === 'SOLD').length;
            const reserved = p.stockItems.filter(s => s.status === 'RESERVED').length;
            return {
                id: p.id,
                product: p.name,
                total,
                available,
                used: sold + reserved,
                lastUpload: p.stockBatches[0]?.createdAt?.toISOString() || '',
            };
        });

        const stats = {
            total: inventory.reduce((s, i) => s + i.total, 0),
            available: inventory.reduce((s, i) => s + i.available, 0),
            used: inventory.reduce((s, i) => s + i.used, 0),
            low: inventory.filter(i => i.available > 0 && i.available <= 5).length,
        };

        return NextResponse.json({ success: true, data: { products: inventory, stats } });
    } catch (error) {
        console.error('[Seller Inventory] GET error:', error);
        return NextResponse.json({ success: false, message: 'Lỗi hệ thống' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    try {
        const shop = await prisma.shop.findUnique({ where: { ownerId: authResult.userId } });
        if (!shop) return NextResponse.json({ success: false, message: 'Không tìm thấy shop' }, { status: 403 });

        const body = await request.json();
        const { productId, items, sourceType, fileName } = body;

        if (!productId || !items || !Array.isArray(items) || items.length === 0) {
            return NextResponse.json({ success: false, message: 'Cần productId và danh sách items' }, { status: 400 });
        }

        // Verify ownership
        const product = await prisma.product.findFirst({ where: { id: productId, shopId: shop.id } });
        if (!product) return NextResponse.json({ success: false, message: 'Không tìm thấy sản phẩm' }, { status: 404 });

        // Create batch
        const validLines = items.filter((line: string) => line.trim());
        const batch = await prisma.stockBatch.create({
            data: {
                productId,
                sourceType: sourceType || 'paste',
                fileName: fileName || null,
                totalLines: items.length,
                validLines: validLines.length,
                invalidLines: items.length - validLines.length,
                uploadedBy: authResult.userId,
            },
        });

        // Create stock items
        await prisma.stockItem.createMany({
            data: validLines.map((line: string) => ({
                productId,
                rawContent: line.trim(),
                status: 'AVAILABLE',
                batchId: batch.id,
                uploadedBy: authResult.userId,
            })),
        });

        // Update product stock cache
        const availableCount = await prisma.stockItem.count({
            where: { productId, status: 'AVAILABLE' },
        });
        await prisma.product.update({
            where: { id: productId },
            data: { stockCountCached: availableCount, lastStockUpdateAt: new Date() },
        });

        return NextResponse.json({
            success: true,
            message: `Đã thêm ${validLines.length} mục tồn kho cho "${product.name}"`,
            data: { batchId: batch.id, added: validLines.length },
        });
    } catch (error) {
        console.error('[Seller Inventory] POST error:', error);
        return NextResponse.json({ success: false, message: 'Lỗi upload tồn kho' }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest) {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    try {
        const shop = await prisma.shop.findUnique({ where: { ownerId: authResult.userId } });
        if (!shop) return NextResponse.json({ success: false, message: 'Không tìm thấy shop' }, { status: 403 });

        const { searchParams } = new URL(request.url);
        const productId = searchParams.get('productId');
        if (!productId) return NextResponse.json({ success: false, message: 'Thiếu productId' }, { status: 400 });

        const product = await prisma.product.findFirst({ where: { id: productId, shopId: shop.id } });
        if (!product) return NextResponse.json({ success: false, message: 'Không tìm thấy' }, { status: 404 });

        // Delete available stock items
        await prisma.stockItem.deleteMany({
            where: { productId, status: 'AVAILABLE' },
        });

        // Update cache
        await prisma.product.update({
            where: { id: productId },
            data: { stockCountCached: 0, lastStockUpdateAt: new Date() },
        });

        return NextResponse.json({ success: true, message: 'Đã xóa tồn kho khả dụng' });
    } catch (error) {
        console.error('[Seller Inventory] DELETE error:', error);
        return NextResponse.json({ success: false, message: 'Lỗi xóa' }, { status: 500 });
    }
}
