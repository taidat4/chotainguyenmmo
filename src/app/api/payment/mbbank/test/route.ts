import { NextResponse } from 'next/server';
import { fetchMBBankTransactionsFromWeb } from '@/lib/mbbank';

// GET /api/payment/mbbank/test — Raw test of MBBank API (admin debug)
export async function GET() {
    // Support both env var names
    const apiKey = process.env.APICANHAN_KEY || process.env.MBBANK_API_KEY || '';
    const username = process.env.MBBANK_USERNAME || '';
    const password = process.env.MBBANK_PASSWORD || '';
    const account = process.env.MBBANK_ACCOUNT || '';
    const sessionId = process.env.MBBANK_SESSION_ID || '';
    const token = process.env.MBBANK_TOKEN || '';
    const cookie = process.env.MBBANK_COOKIE || '';
    const deviceid = process.env.MBBANK_DEVICEID || '';

    const result: any = {
        timestamp: new Date().toISOString(),
        envCheck: {
            APICANHAN_KEY: apiKey ? `✅ Set (${apiKey.slice(0, 8)}...)` : '❌ Missing',
            MBBANK_USERNAME: username ? `✅ ${username}` : '❌ Missing',
            MBBANK_PASSWORD: password ? `✅ Set (${password.length} chars)` : '❌ Missing',
            MBBANK_ACCOUNT: account ? `✅ ${account}` : '❌ Missing',
            MBBANK_SESSION_ID: sessionId ? `✅ Set` : '⚠️ Not set',
            MBBANK_TOKEN: token ? `✅ Set` : '⚠️ Not set',
            MBBANK_COOKIE: cookie ? `✅ Set (${cookie.length} chars)` : '⚠️ Not set',
            MBBANK_DEVICEID: deviceid ? `✅ Set` : '⚠️ Not set',
        },
    };

    if (!apiKey && !sessionId) {
        result.error = 'Missing both APICANHAN_KEY and session credentials';
        return NextResponse.json(result);
    }

    // Use the exact same service as deposit check
    try {
        const transactions = await fetchMBBankTransactionsFromWeb();

        result.transactionCount = transactions.length;
        result.incomingTransactions = transactions.filter((t: any) => t.type === 'IN').length;
        result.outgoingTransactions = transactions.filter((t: any) => t.type === 'OUT').length;
        result.recentTransactions = transactions.slice(0, 5).map((t: any) => ({
            id: t.transactionID,
            amount: t.amount,
            type: t.type,
            date: t.transactionDate,
            description: (t.description || '').substring(0, 100),
        }));
        result.status = 'success';
        result.message = `Lấy được ${transactions.length} giao dịch`;
    } catch (error: any) {
        result.status = 'error';
        result.fetchError = error.message;
    }

    return NextResponse.json(result);
}
