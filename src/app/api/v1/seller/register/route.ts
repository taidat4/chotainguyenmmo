import { NextRequest, NextResponse } from 'next/server';
import {
    createApplication, getApplicationByUser, getAllApplications,
    getPendingApplications, reviewApplication, getAdminSettings,
    updateAdminSettings, isActiveSeller, needsKyc, submitKycForApp
} from '@/lib/seller-store';
import { updateUserRole } from '@/lib/mock-auth';

/**
 * Seller Registration API
 * 
 * GET    — Check application status / list all (admin) / get settings
 * POST   — Submit new seller application
 * PUT    — Review application (admin) / Update settings (admin) / Submit KYC
 */

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');
    const view = searchParams.get('view');

    // Admin: get settings
    if (view === 'settings') {
        return NextResponse.json({ success: true, data: getAdminSettings() });
    }

    // Admin: list all applications
    if (view === 'all') {
        return NextResponse.json({ success: true, data: getAllApplications() });
    }

    // Admin: pending applications
    if (view === 'pending') {
        return NextResponse.json({ success: true, data: getPendingApplications() });
    }

    // User: check own application
    if (userId) {
        const app = getApplicationByUser(userId);
        const settings = getAdminSettings();
        return NextResponse.json({
            success: true,
            data: app,
            settings: {
                kycRequired: settings.kycRequired,
            },
            isActiveSeller: isActiveSeller(userId),
            needsKyc: needsKyc(userId),
        });
    }

    return NextResponse.json({ success: false, message: 'userId required' }, { status: 400 });
}

export async function POST(req: NextRequest) {
    const body = await req.json();
    const { userId, username, userEmail, shopName, bankName, bankAccount, bankOwner,
        kycFullName, kycCccd, kycPhone, kycAddress } = body;

    if (!userId || !shopName || !bankName || !bankAccount || !bankOwner) {
        return NextResponse.json({
            success: false,
            message: 'Vui lòng điền đầy đủ thông tin: tên shop, ngân hàng, số tài khoản, tên chủ TK',
        }, { status: 400 });
    }

    const settings = getAdminSettings();
    if (settings.kycRequired && (!kycFullName || !kycCccd || !kycPhone)) {
        return NextResponse.json({
            success: false,
            message: 'KYC bắt buộc: vui lòng cung cấp họ tên, số CCCD, và số điện thoại',
        }, { status: 400 });
    }

    try {
        const app = createApplication({
            userId, username, userEmail, shopName,
            bankName, bankAccount, bankOwner,
            kycFullName, kycCccd, kycPhone, kycAddress,
        });

        // If auto-approved, upgrade user role
        if (app.status === 'APPROVED') {
            updateUserRole(userId, 'SELLER');
        }

        return NextResponse.json({
            success: true,
            message: app.status === 'APPROVED'
                ? '🎉 Gian hàng đã được tạo thành công! Bạn có thể bắt đầu bán hàng ngay.'
                : '📋 Đơn đăng ký đã được gửi. Admin sẽ duyệt trong 1-3 ngày.',
            data: {
                id: app.id,
                shopName: app.shopName,
                status: app.status,
            },
        }, { status: 201 });
    } catch (err: any) {
        return NextResponse.json({ success: false, message: err.message }, { status: 400 });
    }
}

export async function PUT(req: NextRequest) {
    const body = await req.json();
    const { action } = body;

    // Admin: update settings
    if (action === 'updateSettings') {
        const { kycRequired, autoApprove, autoApproveWhenKycOff } = body;
        const updated = updateAdminSettings({
            kycRequired: kycRequired ?? undefined,
            autoApprove: autoApprove ?? undefined,
            autoApproveWhenKycOff: autoApproveWhenKycOff ?? undefined,
        });
        return NextResponse.json({ success: true, message: 'Cập nhật cài đặt thành công', data: updated });
    }

    // Admin: review application
    if (action === 'review') {
        const { appId, decision, reviewedBy, reason } = body;
        if (!appId || !decision) {
            return NextResponse.json({ success: false, message: 'appId and decision required' }, { status: 400 });
        }

        const result = reviewApplication(appId, decision, reviewedBy || 'admin', reason);
        if (!result) {
            return NextResponse.json({ success: false, message: 'Application not found' }, { status: 404 });
        }

        // If approved, upgrade user role
        if (decision === 'APPROVED') {
            // Find the app to get userId
            const apps = getAllApplications();
            const app = apps.find(a => a.id === appId);
            if (app) {
                updateUserRole(app.userId, 'SELLER');
            }
        }

        return NextResponse.json({
            success: true,
            message: decision === 'APPROVED' ? 'Đã duyệt gian hàng' : 'Đã từ chối đơn đăng ký',
        });
    }

    // User: submit KYC
    if (action === 'submitKyc') {
        const { appId, kycFullName, kycCccd, kycPhone, kycAddress } = body;
        if (!appId || !kycFullName || !kycCccd || !kycPhone) {
            return NextResponse.json({ success: false, message: 'Missing KYC fields' }, { status: 400 });
        }
        const result = submitKycForApp(appId, { kycFullName, kycCccd, kycPhone, kycAddress });
        if (!result) {
            return NextResponse.json({ success: false, message: 'Application not found' }, { status: 404 });
        }
        return NextResponse.json({ success: true, message: 'KYC đã được gửi, chờ admin duyệt.' });
    }

    // Admin: delete application
    if (action === 'delete') {
        const { appId } = body;
        if (!appId) {
            return NextResponse.json({ success: false, message: 'appId required' }, { status: 400 });
        }

        // Get userId before deleting so we can downgrade role
        const apps = getAllApplications();
        const app = apps.find(a => a.id === appId);
        const userId = app?.userId;

        const { deleteApplication } = await import('@/lib/seller-store');
        const result = deleteApplication(appId);
        if (!result) {
            return NextResponse.json({ success: false, message: 'Application not found' }, { status: 404 });
        }

        // Downgrade user role back to USER
        if (userId) {
            updateUserRole(userId, 'USER');
        }

        return NextResponse.json({ success: true, message: 'Đã xóa gian hàng/đơn đăng ký' });
    }

    return NextResponse.json({ success: false, message: 'Invalid action' }, { status: 400 });
}
