import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { randomBytes } from 'crypto';

const MAX_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export async function POST(request: NextRequest) {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    try {
        const formData = await request.formData();
        const file = formData.get('file') as File | null;

        if (!file) {
            return NextResponse.json({ success: false, message: 'Chưa chọn file' }, { status: 400 });
        }

        if (!ALLOWED_TYPES.includes(file.type)) {
            return NextResponse.json({ success: false, message: 'Chỉ hỗ trợ JPG, PNG, WebP, GIF' }, { status: 400 });
        }

        if (file.size > MAX_SIZE) {
            return NextResponse.json({ success: false, message: 'File quá lớn (tối đa 5MB)' }, { status: 400 });
        }

        // Generate unique filename
        const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
        const uniqueName = `${Date.now()}_${randomBytes(4).toString('hex')}.${ext}`;

        // Ensure upload directory exists — use 'type' from form data or default to 'products'
        const type = (formData.get('type') as string)?.replace(/[^a-zA-Z0-9-_]/g, '') || 'products';
        const uploadDir = path.join(process.cwd(), 'public', 'uploads', type);
        await mkdir(uploadDir, { recursive: true });

        // Write file
        const buffer = Buffer.from(await file.arrayBuffer());
        const filePath = path.join(uploadDir, uniqueName);
        await writeFile(filePath, buffer);

        const url = `/uploads/${type}/${uniqueName}`;
        return NextResponse.json({ success: true, url });
    } catch (error) {
        console.error('[Upload] Error:', error);
        return NextResponse.json({ success: false, message: 'Lỗi upload file' }, { status: 500 });
    }
}
