import { NextRequest, NextResponse } from 'next/server';
import { signToken } from '@/lib/auth';
import { findMockUserByUsername, findMockUserByEmail, createMockUser } from '@/lib/mock-auth';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { username, email, password, fullName, termsAccepted } = body;

        // Validation
        if (!username || !email || !password || !fullName) {
            return NextResponse.json(
                { success: false, message: 'Vui lòng điền đầy đủ thông tin', errorCode: 'VALIDATION_ERROR' },
                { status: 400 }
            );
        }

        if (!termsAccepted) {
            return NextResponse.json(
                { success: false, message: 'Bạn phải đồng ý với điều khoản sử dụng', errorCode: 'TERMS_NOT_ACCEPTED' },
                { status: 400 }
            );
        }

        if (!/^[a-zA-Z0-9_.]{3,30}$/.test(username)) {
            return NextResponse.json(
                { success: false, message: 'Tên đăng nhập chỉ chứa chữ, số, dấu chấm và gạch dưới (3–30 ký tự)', errorCode: 'INVALID_USERNAME' },
                { status: 400 }
            );
        }

        if (password.length < 8) {
            return NextResponse.json(
                { success: false, message: 'Mật khẩu phải có ít nhất 8 ký tự', errorCode: 'VALIDATION_ERROR' },
                { status: 400 }
            );
        }

        // Check username exists
        if (findMockUserByUsername(username)) {
            return NextResponse.json(
                { success: false, message: 'Tên đăng nhập đã được sử dụng', errorCode: 'USERNAME_EXISTS' },
                { status: 409 }
            );
        }

        // Check email exists
        if (findMockUserByEmail(email)) {
            return NextResponse.json(
                { success: false, message: 'Email đã được sử dụng', errorCode: 'EMAIL_EXISTS' },
                { status: 409 }
            );
        }

        // Create user (mock)
        const user = createMockUser({ username, email, fullName, password });

        // Generate JWT
        const token = await signToken({
            userId: user.id,
            username: user.username,
            email: user.email,
            role: user.role,
        });

        return NextResponse.json({
            success: true,
            message: 'Tạo tài khoản thành công',
            data: {
                token,
                user: {
                    id: user.id,
                    username: user.username,
                    email: user.email,
                    fullName: user.fullName,
                    role: user.role,
                },
            },
        }, { status: 201 });
    } catch (error) {
        console.error('Register error:', error);
        return NextResponse.json(
            { success: false, message: 'Có lỗi xảy ra. Vui lòng thử lại sau.', errorCode: 'INTERNAL_ERROR' },
            { status: 500 }
        );
    }
}
