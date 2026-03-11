import { NextResponse } from 'next/server';

// GET /api/payment/mbbank/test — Raw test of MBBank API (admin debug)
export async function GET() {
    const apiKey = process.env.MBBANK_API_KEY || '';
    const username = process.env.MBBANK_USERNAME || '';
    const password = process.env.MBBANK_PASSWORD || '';
    const account = process.env.MBBANK_ACCOUNT || '';
    const apiUrl = process.env.MBBANK_API_URL || 'https://apicanhan.com/api/mbbankv3';

    const result: any = {
        timestamp: new Date().toISOString(),
        envCheck: {
            MBBANK_API_KEY: apiKey ? `✅ Set (${apiKey.slice(0, 8)}...)` : '❌ Missing',
            MBBANK_USERNAME: username ? `✅ ${username}` : '❌ Missing',
            MBBANK_PASSWORD: password ? `✅ Set (${password.length} chars)` : '❌ Missing',
            MBBANK_ACCOUNT: account ? `✅ ${account}` : '❌ Missing',
            MBBANK_API_URL: apiUrl,
        },
    };

    if (!apiKey || !username) {
        result.error = 'Missing required env vars';
        return NextResponse.json(result);
    }

    // Test 1: Call the API and return RAW response
    try {
        const params = new URLSearchParams({
            key: apiKey,
            username: username,
            password: password,
            accountNo: account,
        });

        const fullUrl = `${apiUrl}?${params}`;
        result.requestUrl = fullUrl.replace(apiKey, '***').replace(password, '***');
        result.requestMethod = 'GET';

        const response = await fetch(fullUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0',
                'Accept': 'application/json',
            },
            signal: AbortSignal.timeout(15000),
        });

        result.httpStatus = response.status;
        result.httpStatusText = response.statusText;
        result.responseHeaders = Object.fromEntries(response.headers.entries());

        const responseText = await response.text();
        result.rawResponseLength = responseText.length;

        // Try to parse as JSON
        try {
            const data = JSON.parse(responseText);
            result.parsedResponse = data;

            // Analyze transactions
            if (data.transactions) {
                result.transactionCount = data.transactions.length;
                result.incomingTransactions = data.transactions.filter((t: any) => t.type === 'IN').length;
                result.outgoingTransactions = data.transactions.filter((t: any) => t.type === 'OUT').length;

                // Show last 5 transactions (summarized)
                result.recentTransactions = data.transactions.slice(0, 5).map((t: any) => ({
                    id: t.transactionID,
                    amount: t.amount,
                    type: t.type,
                    date: t.transactionDate,
                    description: (t.description || '').substring(0, 100),
                }));
            } else {
                result.warning = 'No transactions array in response';
            }
        } catch {
            result.rawResponse = responseText.substring(0, 500);
            result.parseError = 'Response is not valid JSON';
        }
    } catch (error: any) {
        result.fetchError = error.message;
        result.errorType = error.constructor?.name;
    }

    return NextResponse.json(result);
}
