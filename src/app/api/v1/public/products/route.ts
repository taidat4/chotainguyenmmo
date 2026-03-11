import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey } from '@/lib/api-keys';
import { products } from '@/lib/mock-data';

/**
 * Public API — Products
 * Auth: API Key via x-api-key header or ?api_key= query param
 * 
 * GET /api/v1/public/products          — List all products
 * GET /api/v1/public/products?q=...    — Search products
 * GET /api/v1/public/products?id=...   — Get single product
 */
export async function GET(req: NextRequest) {
    // Validate API key
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

    // Single product
    if (id) {
        const product = products.find(p => p.id === id);
        if (!product) {
            return NextResponse.json({ success: false, message: 'Product not found' }, { status: 404 });
        }
        return NextResponse.json({
            success: true,
            data: {
                id: product.id,
                name: product.name,
                price: product.price,
                originalPrice: product.compareAtPrice,
                description: product.description,
                category: product.categoryName,
                shop: product.shopName,
                rating: product.ratingAverage,
                sold: product.soldCount,
                inStock: product.stockCount > 0,
                stock: product.stockCount,
                image: product.images?.[0],
            },
        });
    }

    // List/search products
    let filtered = [...products];
    if (q) {
        const lower = q.toLowerCase();
        filtered = filtered.filter(p =>
            p.name.toLowerCase().includes(lower) ||
            p.description.toLowerCase().includes(lower) ||
            p.categoryName.toLowerCase().includes(lower)
        );
    }
    if (category) {
        filtered = filtered.filter(p => p.categoryName.toLowerCase() === category.toLowerCase());
    }

    const total = filtered.length;
    const start = (page - 1) * limit;
    const paginated = filtered.slice(start, start + limit);

    return NextResponse.json({
        success: true,
        data: paginated.map(p => ({
            id: p.id,
            name: p.name,
            price: p.price,
            originalPrice: p.compareAtPrice,
            category: p.categoryName,
            shop: p.shopName,
            rating: p.ratingAverage,
            sold: p.soldCount,
            inStock: p.stockCount > 0,
            stock: p.stockCount,
        })),
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        },
        meta: {
            apiKeyId: keyData.id,
            rateLimit: keyData.rateLimit,
        },
    });
}
