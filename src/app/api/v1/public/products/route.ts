import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey } from '@/lib/api-keys';
import prisma from '@/lib/prisma';

/**
 * Public API — Products
 * Auth: API Key via x-api-key header or ?api_key= query param
 * 
 * GET /api/v1/public/products          — List all products
 * GET /api/v1/public/products?q=...    — Search products
 * GET /api/v1/public/products?id=...   — Get single product
 */
export async function GET(req: NextRequest) {
    const apiKey = req.headers.get('x-api-key') || new URL(req.url).searchParams.get('api_key');
    if (!apiKey) {
        return NextResponse.json({
            success: false,
            message: 'API Key required. Pass via x-api-key header or ?api_key= query param.',
            docs: '/api-docs',
        }, { status: 401 });
    }

    const keyData = validateApiKey(apiKey);
    if (!keyData) {
        return NextResponse.json({ success: false, message: 'Invalid or revoked API Key' }, { status: 403 });
    }

    if (!keyData.permissions.includes('products:read')) {
        return NextResponse.json({ success: false, message: 'Permission denied: products:read required' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q') || '';
    const id = searchParams.get('id') || '';
    const category = searchParams.get('category') || '';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);

    try {
        // Single product
        if (id) {
            const product = await prisma.product.findUnique({
                where: { id },
                include: {
                    shop: { select: { name: true } },
                    category: { select: { name: true } },
                    images: { take: 1, orderBy: { sortOrder: 'asc' } },
                },
            });
            if (!product) {
                return NextResponse.json({ success: false, message: 'Product not found' }, { status: 404 });
            }
            const stockCount = await prisma.stockItem.count({ where: { productId: id, status: 'AVAILABLE' } });
            return NextResponse.json({
                success: true,
                data: {
                    id: product.id,
                    name: product.name,
                    price: product.price,
                    originalPrice: product.compareAtPrice,
                    description: product.description,
                    category: product.category?.name,
                    shop: product.shop?.name,
                    rating: product.ratingAverage,
                    sold: product.soldCount,
                    inStock: stockCount > 0,
                    stock: stockCount,
                    image: (product as any).images?.[0]?.url,
                },
            });
        }

        // Build where clause
        const where: any = { status: 'ACTIVE' };
        if (q) {
            where.OR = [
                { name: { contains: q, mode: 'insensitive' } },
                { description: { contains: q, mode: 'insensitive' } },
            ];
        }
        if (category) {
            where.category = { name: { equals: category, mode: 'insensitive' } };
        }

        const [total, products] = await Promise.all([
            prisma.product.count({ where }),
            prisma.product.findMany({
                where,
                include: { shop: { select: { name: true } }, category: { select: { name: true } } },
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * limit,
                take: limit,
            }),
        ]);

        return NextResponse.json({
            success: true,
            data: products.map(p => ({
                id: p.id,
                name: p.name,
                price: p.price,
                originalPrice: p.compareAtPrice,
                category: p.category?.name,
                shop: p.shop?.name,
                rating: p.ratingAverage,
                sold: p.soldCount,
                inStock: true,
                stock: 0,
            })),
            pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
            meta: { apiKeyId: keyData.id, rateLimit: keyData.rateLimit },
        });
    } catch (error) {
        console.error('[Public Products] Error:', error);
        return NextResponse.json({ success: false, message: 'Internal error' }, { status: 500 });
    }
}
