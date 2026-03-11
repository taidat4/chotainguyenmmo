import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const CONFIG_PATH = path.join(process.cwd(), 'MY_BOT', 'MY_BOT', 'mbbank-main', 'config', 'config.json');

// GET: Read current payment gateway config
export async function GET() {
    try {
        const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
        const config = JSON.parse(raw);

        // Mask sensitive fields for display
        const masked = {
            ...config,
            apicanhanKey: config.apicanhanKey ? config.apicanhanKey.substring(0, 8) + '****' : '',
            apicanhanPass: config.apicanhanPass ? '****' : '',
            token: config.token ? config.token.substring(0, 20) + '****' : '',
            cookie: config.cookie ? config.cookie.substring(0, 30) + '...' : '',
            sessionId: config.sessionId || '',
            botToken: config.botToken ? config.botToken.substring(0, 10) + '****' : '',
        };

        return NextResponse.json({
            status: 'success',
            config: masked,
            rawKeys: Object.keys(config),
        });
    } catch (error: any) {
        return NextResponse.json({ error: 'Config file not found: ' + error.message }, { status: 500 });
    }
}

// PUT: Update payment gateway config
export async function PUT(req: NextRequest) {
    try {
        const newConfig = await req.json();

        // Read existing config first
        let existingConfig: any = {};
        try {
            const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
            existingConfig = JSON.parse(raw);
        } catch { }

        // Merge: only update fields that are not masked (****) 
        const mergedConfig = { ...existingConfig };
        for (const [key, value] of Object.entries(newConfig)) {
            if (typeof value === 'string' && !value.includes('****') && value !== '') {
                mergedConfig[key] = value;
            }
        }

        // Write back
        fs.writeFileSync(CONFIG_PATH, JSON.stringify(mergedConfig, null, 2), 'utf-8');

        return NextResponse.json({
            status: 'success',
            message: 'Config updated successfully',
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
