import { NextRequest, NextResponse } from 'next/server';
import { createApiKey, getApiKeysByUser, revokeApiKey, updateApiKeyGoogleSheet, CUSTOMER_PERMISSIONS, SELLER_PERMISSIONS } from '@/lib/api-keys';

// GET: List API keys for current user
export async function GET(req: NextRequest) {
    // Get user from auth header (simplified — use JWT in production)
    const userId = req.headers.get('x-user-id') || '';
    const username = req.headers.get('x-username') || '';

    if (!userId) {
        // Try cookie/localStorage fallback for browser requests
        const authHeader = req.headers.get('authorization');
        if (!authHeader) {
            return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
        }
    }

    const keys = getApiKeysByUser(userId);
    return NextResponse.json({
        success: true,
        data: keys.map(k => ({
            id: k.id,
            key: k.key, // Already masked
            label: k.label,
            type: k.type,
            permissions: k.permissions,
            isActive: k.isActive,
            createdAt: k.createdAt,
            lastUsed: k.lastUsed,
            usageCount: k.usageCount,
            rateLimit: k.rateLimit,
            googleSheetUrl: k.googleSheetUrl,
            googleSheetSyncEnabled: k.googleSheetSyncEnabled,
            googleSheetLastSync: k.googleSheetLastSync,
        })),
        permissionOptions: {
            CUSTOMER: CUSTOMER_PERMISSIONS,
            SELLER: SELLER_PERMISSIONS,
        },
    });
}

// POST: Create new API key
export async function POST(req: NextRequest) {
    const body = await req.json();
    const { userId, username, label, type, permissions, googleSheetUrl } = body;

    if (!userId || !label || !type) {
        return NextResponse.json({ success: false, message: 'Missing required fields' }, { status: 400 });
    }

    const validPerms = type === 'SELLER'
        ? SELLER_PERMISSIONS.map(p => p.id)
        : CUSTOMER_PERMISSIONS.map(p => p.id);

    const filteredPerms = (permissions || validPerms).filter((p: string) => validPerms.includes(p));

    const { apiKey, rawKey } = createApiKey({
        userId,
        username: username || '',
        label,
        type,
        permissions: filteredPerms,
        googleSheetUrl,
    });

    return NextResponse.json({
        success: true,
        message: 'API Key đã được tạo thành công',
        data: {
            id: apiKey.id,
            key: rawKey, // Show full key ONCE — user must save it
            label: apiKey.label,
            type: apiKey.type,
            permissions: apiKey.permissions,
            rateLimit: apiKey.rateLimit,
        },
        warning: '⚠️ Lưu API Key này ngay! Bạn sẽ không thể xem lại key đầy đủ sau khi đóng trang này.',
    }, { status: 201 });
}

// DELETE: Revoke API key
export async function DELETE(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const keyId = searchParams.get('id');
    const userId = searchParams.get('userId');

    if (!keyId || !userId) {
        return NextResponse.json({ success: false, message: 'Missing key ID or user ID' }, { status: 400 });
    }

    const result = revokeApiKey(keyId, userId);
    if (result) {
        return NextResponse.json({ success: true, message: 'API Key đã bị thu hồi' });
    }
    return NextResponse.json({ success: false, message: 'Không tìm thấy API Key' }, { status: 404 });
}

// PUT: Update API key (Google Sheets config)
export async function PUT(req: NextRequest) {
    const body = await req.json();
    const { keyId, userId, googleSheetUrl, googleSheetSyncEnabled } = body;

    if (!keyId || !userId) {
        return NextResponse.json({ success: false, message: 'Missing key ID or user ID' }, { status: 400 });
    }

    const result = updateApiKeyGoogleSheet(keyId, userId, googleSheetUrl || '', googleSheetSyncEnabled ?? false);
    if (result) {
        return NextResponse.json({ success: true, message: 'Cập nhật thành công' });
    }
    return NextResponse.json({ success: false, message: 'Không tìm thấy API Key' }, { status: 404 });
}
