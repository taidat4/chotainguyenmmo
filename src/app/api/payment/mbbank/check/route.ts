import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/payment/mbbank/check
 * Exact copy of Credit-Flow's fetchTransactions + matching logic
 * No auth required — just checks MBBank API for a specific deposit
 */
export async function POST(request: NextRequest) {
    try {
        const { depositCode, amount } = await request.json();

        if (!depositCode || !amount) {
            return NextResponse.json({ status: 'error', message: 'Thiếu depositCode hoặc amount' }, { status: 400 });
        }

        // Read config from env — exactly like Credit-Flow reads from DB
        const apiKey = process.env.MBBANK_API_KEY || '';
        const accountNo = process.env.MBBANK_ACCOUNT || '';
        const username = process.env.MBBANK_USERNAME || accountNo;
        const password = process.env.MBBANK_PASSWORD || '';

        if (!apiKey || !accountNo) {
            return NextResponse.json({ status: 'error', message: 'Chưa cấu hình MBBANK_API_KEY hoặc MBBANK_ACCOUNT' }, { status: 500 });
        }

        // ===== FETCH TRANSACTIONS — exact Credit-Flow logic =====
        const params = new URLSearchParams({
            key: apiKey,
            username: username,
            password: password,
            accountNo: accountNo,
        });

        const url = `https://apicanhan.com/api/mbbankv3?${params.toString()}`;
        console.log(`[MBBank-Check] Fetching: key=***${apiKey.slice(-6)}, user=${username}, account=${accountNo}`);

        let transactions: any[] = [];
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 30000);
            const response = await fetch(url, { signal: controller.signal });
            clearTimeout(timeout);

            if (!response.ok) {
                console.log(`[MBBank-Check] API HTTP error: ${response.status}`);
                return NextResponse.json({ status: 'error', message: `API HTTP ${response.status}` });
            }

            const data = await response.json();
            console.log(`[MBBank-Check] API status=${data.status}, message=${data.message || 'none'}`);

            if (data.status !== 'success') {
                return NextResponse.json({ status: 'error', message: `API lỗi: ${data.message}` });
            }

            const txList = data.transactions || [];
            if (!Array.isArray(txList)) {
                return NextResponse.json({ status: 'error', message: 'API trả về transactions không phải array' });
            }

            transactions = txList;
            console.log(`[MBBank-Check] Got ${transactions.length} transactions`);
        } catch (err: any) {
            if (err.name === 'AbortError') {
                return NextResponse.json({ status: 'error', message: 'API timeout (30s)' });
            }
            return NextResponse.json({ status: 'error', message: `Fetch error: ${err.message}` });
        }

        if (transactions.length === 0) {
            return NextResponse.json({
                status: 'not_found',
                message: 'API trả về 0 giao dịch. Kiểm tra lại API key và credentials trên apicanhan.com.',
                debug: { apiKey: `***${apiKey.slice(-6)}`, username, accountNo, txCount: 0 },
            });
        }

        // ===== MATCH TRANSACTIONS — exact Credit-Flow logic =====
        // Credit-Flow uses: creditAmount || amount, description || addDescription
        const searchCode = depositCode.toUpperCase().replace(/\s/g, '');
        const searchAmount = parseInt(amount);

        console.log(`[MBBank-Check] Looking for code="${searchCode}", amount=${searchAmount}`);

        for (const tx of transactions) {
            if (!tx || typeof tx !== 'object') continue;

            // Credit-Flow field mapping
            const txAmount = Number(tx.creditAmount || tx.amount || 0);
            const txDesc = (tx.description || tx.addDescription || '').toUpperCase().replace(/\s/g, '');
            const txRef = String(tx.transactionNumber || tx.refNo || tx.transactionID || tx.id || '');

            if (txAmount <= 0) continue;

            console.log(`[MBBank-Check]   TX: ref=${txRef}, amount=${txAmount}, desc="${(tx.description || '').substring(0, 60)}"`);

            // Check if description contains deposit code
            if (txDesc.includes(searchCode)) {
                console.log(`[MBBank-Check] ✓ MATCH FOUND! ref=${txRef}, amount=${txAmount}`);
                return NextResponse.json({
                    status: 'found',
                    transaction: {
                        transaction_id: txRef,
                        amount: txAmount,
                        description: tx.description || tx.addDescription || '',
                        transaction_date: tx.transactionDate || '',
                        type: tx.type || 'IN',
                    },
                    message: `Tìm thấy giao dịch ${txRef} — ${txAmount.toLocaleString('vi-VN')}đ`,
                });
            }
        }

        console.log(`[MBBank-Check] ✗ No match found in ${transactions.length} transactions`);
        return NextResponse.json({
            status: 'not_found',
            message: 'Chưa tìm thấy giao dịch phù hợp.',
            debug: { txCount: transactions.length, searchCode, searchAmount },
        });
    } catch (error: any) {
        console.error('[MBBank-Check] Fatal error:', error);
        return NextResponse.json({ status: 'error', message: error.message }, { status: 500 });
    }
}
