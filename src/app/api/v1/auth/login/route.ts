import { NextRequest, NextResponse } from 'next/server';
import { signToken } from '@/lib/auth';
import { findMockUserByUsername, verifyMockPassword } from '@/lib/mock-auth';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { username, password } = body;

        if (!username || !password) {
            return NextResponse.json(
                { success: false, message: 'Vui lòng nhập tên đăng nhập và mật khẩu', errorCode: 'VALIDATION_ERROR' },
                { status: 400 }
            );
        }

        const user = findMockUserByUsername(username);
        if (!user) {
            return NextResponse.json(
                { success: false, message: 'Tên đăng nhập hoặc mật khẩu không đúng', errorCode: 'INVALID_CREDENTIALS' },
                { status: 401 }
            );
        }

        if (!verifyMockPassword(username, password)) {
            return NextResponse.json(
                { success: false, message: 'Tên đăng nhập hoặc mật khẩu không đúng', errorCode: 'INVALID_CREDENTIALS' },
                { status: 401 }
            );
        }

        const token = await signToken({
            userId: user.id,
            username: user.username,
            email: user.email,
            role: user.role,
        });

        const response = NextResponse.json({
            success: true,
            message: 'Đăng nhập thành công',
            data: {
                token,
                user: {
                    id: user.id,
                    username: user.username,
                    email: user.email,
                    fullName: user.fullName,
                    role: user.role,
                    avatarUrl: null,
                    walletBalance: user.walletBalance,
                },
            },
        });

        // Set cookie
        response.cookies.set('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 60 * 60 * 24 * 7,
            path: '/',
        });

        return response;
    } catch (error) {
        console.error('Login error:', error);
        return NextResponse.json(
            { success: false, message: 'Có lỗi xảy ra. Vui lòng thử lại sau.', errorCode: 'INTERNAL_ERROR' },
            { status: 500 }
        );
    }
}
