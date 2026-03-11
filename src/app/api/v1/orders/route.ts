import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth, generateOrderCode } from '@/lib/auth';

// POST /api/v1/orders — Create a new order (purchase)
export async function POST(request: NextRequest) {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    try {
        const { productId, quantity = 1 } = await request.json();

        if (!productId || quantity < 1) {
            return NextResponse.json(
                { success: false, message: 'Dữ liệu không hợp lệ', errorCode: 'VALIDATION_ERROR' },
                { status: 400 }
            );
        }

        // Get product
        const product = await prisma.product.findUnique({
            where: { id: productId },
            include: { shop: true },
        });

        if (!product || product.status !== 'ACTIVE') {
            return NextResponse.json(
                { success: false, message: 'Sản phẩm không tồn tại hoặc ngừng bán', errorCode: 'PRODUCT_UNAVAILABLE' },
                { status: 400 }
            );
        }

        if (quantity < product.minPurchaseQty || quantity > product.maxPurchaseQty) {
            return NextResponse.json(
                { success: false, message: `Số lượng phải từ ${product.minPurchaseQty} đến ${product.maxPurchaseQty}`, errorCode: 'INVALID_QUANTITY' },
                { status: 400 }
            );
        }

        const totalAmount = product.price * quantity;
        const commissionRate = parseInt(process.env.PLATFORM_COMMISSION_RATE || '5');
        const feeAmount = Math.floor(totalAmount * commissionRate / 100);

        // Transaction: check balance, check stock, create order, deduct wallet, reserve stock
        const result = await prisma.$transaction(async (tx) => {
            // 1. Get wallet with lock
            const wallet = await tx.wallet.findUnique({ where: { userId: authResult.userId } });
            if (!wallet || wallet.availableBalance < totalAmount) {
                throw new Error('INSUFFICIENT_BALANCE');
            }

            // 2. Check available stock
            const availableStock = await tx.stockItem.findMany({
                where: { productId, status: 'AVAILABLE' },
                take: quantity,
            });

            if (availableStock.length < quantity) {
                throw new Error('INSUFFICIENT_STOCK');
            }

            // 3. Create order
            const orderCode = generateOrderCode();
            const order = await tx.order.create({
                data: {
                    orderCode,
                    buyerId: authResult.userId,
                    shopId: product.shopId,
                    status: 'PAID',
                    subtotal: totalAmount,
                    feeAmount,
                    totalAmount,
                    paymentStatus: 'PAID',
                    deliveryStatus: product.deliveryType === 'AUTO' ? 'DELIVERED' : 'PENDING',
                    paidAt: new Date(),
                    deliveredAt: product.deliveryType === 'AUTO' ? new Date() : null,
                    completedAt: product.deliveryType === 'AUTO' ? new Date() : null,
                    items: {
                        create: {
                            productId,
                            quantity,
                            unitPrice: product.price,
                            total: totalAmount,
                        },
                    },
                },
            });

            // 4. Deduct buyer wallet
            await tx.wallet.update({
                where: { userId: authResult.userId },
                data: {
                    availableBalance: { decrement: totalAmount },
                    totalSpent: { increment: totalAmount },
                },
            });

            // 5. Record wallet transaction (buyer)
            await tx.walletTransaction.create({
                data: {
                    walletId: wallet.id,
                    type: 'PURCHASE',
                    direction: 'DEBIT',
                    amount: totalAmount,
                    balanceAfter: wallet.availableBalance - totalAmount,
                    referenceType: 'order',
                    referenceId: order.id,
                    description: `Mua ${product.name} x${quantity}`,
                },
            });

            // 6. Credit seller wallet (held balance)
            const sellerEarning = totalAmount - feeAmount;
            const sellerWallet = await tx.wallet.findUnique({ where: { userId: product.shop.ownerId } });
            if (sellerWallet) {
                await tx.wallet.update({
                    where: { userId: product.shop.ownerId },
                    data: { heldBalance: { increment: sellerEarning } },
                });

                await tx.walletTransaction.create({
                    data: {
                        walletId: sellerWallet.id,
                        type: 'SALE_EARNING',
                        direction: 'CREDIT',
                        amount: sellerEarning,
                        balanceAfter: sellerWallet.availableBalance,
                        referenceType: 'order',
                        referenceId: order.id,
                        description: `Bán ${product.name} x${quantity} (sau phí ${commissionRate}%)`,
                    },
                });
            }

            // 7. Mark stock as sold & create delivery
            const stockIds = availableStock.map(s => s.id);
            await tx.stockItem.updateMany({
                where: { id: { in: stockIds } },
                data: { status: 'SOLD', soldAt: new Date(), orderId: order.id },
            });

            // 8. Create delivery with stock content
            if (product.deliveryType === 'AUTO') {
                const deliveryContent = availableStock.map(s => s.rawContent).join('\n');
                await tx.delivery.create({
                    data: {
                        orderId: order.id,
                        content: deliveryContent,
                        status: 'DELIVERED',
                    },
                });
            }

            // 9. Update product counts
            await tx.product.update({
                where: { id: productId },
                data: {
                    soldCount: { increment: quantity },
                    stockCountCached: { decrement: quantity },
                },
            });

            return order;
        });

        return NextResponse.json({
            success: true,
            message: 'Đơn hàng đã được tạo thành công',
            data: { orderId: result.id, orderCode: result.orderCode },
        }, { status: 201 });
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : '';
        if (msg === 'INSUFFICIENT_BALANCE') {
            return NextResponse.json(
                { success: false, message: 'Số dư ví không đủ để thực hiện giao dịch này', errorCode: 'INSUFFICIENT_BALANCE' },
                { status: 400 }
            );
        }
        if (msg === 'INSUFFICIENT_STOCK') {
            return NextResponse.json(
                { success: false, message: 'Sản phẩm hiện không còn đủ tồn kho', errorCode: 'INSUFFICIENT_STOCK' },
                { status: 400 }
            );
        }
        console.error('Create order error:', error);
        return NextResponse.json(
            { success: false, message: 'Có lỗi xảy ra. Vui lòng thử lại sau.', errorCode: 'INTERNAL_ERROR' },
            { status: 500 }
        );
    }
}

// GET /api/v1/orders — List user orders
export async function GET(request: NextRequest) {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    try {
        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get('page') || '1');
        const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50);
        const status = searchParams.get('status');

        const where: Record<string, unknown> = { buyerId: authResult.userId };
        if (status) where.status = status;

        const [orders, total] = await Promise.all([
            prisma.order.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * limit,
                take: limit,
                include: {
                    items: { include: { product: { select: { name: true, slug: true, price: true } } } },
                    shop: { select: { name: true, slug: true } },
                },
            }),
            prisma.order.count({ where }),
        ]);

        return NextResponse.json({
            success: true,
            data: { orders, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } },
        });
    } catch (error) {
        console.error('List orders error:', error);
        return NextResponse.json(
            { success: false, message: 'Lỗi hệ thống', errorCode: 'INTERNAL_ERROR' },
            { status: 500 }
        );
    }
}
