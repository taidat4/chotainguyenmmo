import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const CONFIG_PATH = path.join(process.cwd(), 'MY_BOT', 'MY_BOT', 'mbbank-main', 'config', 'config.json');

function getConfig() {
    try {
        const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

// GET: Fetch latest transactions from MBBank via apicanhan
export async function GET() {
    const config = getConfig();
    if (!config) {
        return NextResponse.json({ error: 'MBBank config not found' }, { status: 500 });
    }

    try {
        // Use apicanhan to fetch transactions
        const apiUrl = `https://apicanhan.com/api/mb/transactions`;
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                apiKey: config.apicanhanKey,
                username: config.apicanhanUser,
                password: config.apicanhanPass,
                accountNo: config.apicanhanAccount,
            }),
        });

        if (!response.ok) {
            // Fallback: try reading local api_response.json for demo
            const fallbackPath = path.join(process.cwd(), 'MY_BOT', 'MY_BOT', 'api_response.json');
            if (fs.existsSync(fallbackPath)) {
                const data = JSON.parse(fs.readFileSync(fallbackPath, 'utf-8'));
                return NextResponse.json({
                    status: 'success',
                    source: 'local_cache',
                    transactions: data.transactions?.slice(0, 50) || [],
                    accountNo: config.accountNo,
                });
            }
            return NextResponse.json({ error: 'Failed to fetch from MBBank API' }, { status: 502 });
        }

        const data = await response.json();
        return NextResponse.json({
            status: 'success',
            source: 'live',
            transactions: data.transactions || [],
            accountNo: config.accountNo,
        });
    } catch (error: any) {
        // Fallback to local cache
        const fallbackPath = path.join(process.cwd(), 'MY_BOT', 'MY_BOT', 'api_response.json');
        if (fs.existsSync(fallbackPath)) {
            const data = JSON.parse(fs.readFileSync(fallbackPath, 'utf-8'));
            return NextResponse.json({
                status: 'success',
                source: 'local_cache',
                transactions: data.transactions?.slice(0, 50) || [],
                accountNo: config.accountNo,
            });
        }
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// POST: Check if a specific deposit code exists in transactions (auto-verify deposit)
export async function POST(req: NextRequest) {
    const { depositCode, amount } = await req.json();
    const config = getConfig();
    if (!config) {
        return NextResponse.json({ error: 'MBBank config not found' }, { status: 500 });
    }

    try {
        // Try live API first, fallback to local
        let transactions: any[] = [];

        try {
            const apiUrl = `https://apicanhan.com/api/mb/transactions`;
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    apiKey: config.apicanhanKey,
                    username: config.apicanhanUser,
                    password: config.apicanhanPass,
                    accountNo: config.apicanhanAccount,
                }),
            });
            if (response.ok) {
                const data = await response.json();
                transactions = data.transactions || [];
            }
        } catch {
            // Use local cache
        }

        if (transactions.length === 0) {
            const fallbackPath = path.join(process.cwd(), 'MY_BOT', 'MY_BOT', 'api_response.json');
            if (fs.existsSync(fallbackPath)) {
                const data = JSON.parse(fs.readFileSync(fallbackPath, 'utf-8'));
                transactions = data.transactions || [];
            }
        }

        // Search for matching transaction
        const match = transactions.find((tx: any) => {
            const desc = (tx.description || '').toUpperCase();
            const codeMatch = depositCode && desc.includes(depositCode.toUpperCase());
            const amountMatch = amount ? parseInt(tx.amount) === parseInt(amount) : true;
            const isIncoming = tx.type === 'IN';
            return codeMatch && amountMatch && isIncoming;
        });

        if (match) {
            return NextResponse.json({
                status: 'found',
                transaction: match,
                message: `Đã tìm thấy giao dịch ${match.transactionID} với số tiền ${parseInt(match.amount).toLocaleString('vi-VN')}đ`,
            });
        }

        return NextResponse.json({
            status: 'not_found',
            message: 'Chưa tìm thấy giao dịch. Vui lòng chờ 1-5 phút và thử lại.',
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
