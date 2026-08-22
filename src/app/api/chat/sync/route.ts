
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { StreamChat } from 'stream-chat';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

const apiKey = process.env.NEXT_PUBLIC_STREAM_API_KEY!;
const apiSecret = process.env.STREAM_API_SECRET!;

export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
        }

        // 1. Fetch all 'accepted' connections for this user
        const { data: connections, error: connError } = await supabase
            .from('connection_requests')
            .select('*')
            .eq('status', 'accepted')
            .or(`patient_id.eq.${user.id},doctor_id.eq.${user.id}`);

        if (connError) throw connError;

        if (!connections || connections.length === 0) {
            return NextResponse.json({ success: true, count: 0 });
        }

        const serverClient = StreamChat.getInstance(apiKey, apiSecret, {
            timeout: 15000,  // 15s — default 3s is too low for slower networks
        });
        let syncedCount = 0;
        let failedCount = 0;

        // 2. Ensure a channel exists for each connection
        for (const conn of connections) {
            try {
                const sortedIds = [conn.doctor_id, conn.patient_id].sort();
                const fullHash = crypto.createHash('sha256')
                    .update(`${process.env.CHAT_SECRET_SALT || 'dermiassist_salt'}:${sortedIds[0]}:${sortedIds[1]}`)
                    .digest('hex');
                // Stream Chat enforces max 64 chars for channel IDs.
                // "consult_" = 8 chars, so use first 48 hex chars (56 total).
                const channelId = `consult_${fullHash.substring(0, 48)}`;

                const channel = serverClient.channel('messaging', channelId, {
                    members: [conn.patient_id, conn.doctor_id],
                    created_by_id: conn.doctor_id,
                });

                // This will create the channel if it doesn't exist, or just update it if it does
                await channel.create();
                syncedCount++;
            } catch (channelError: any) {
                failedCount++;
                console.warn(`[Chat Sync] Failed to sync channel for connection ${conn.id}:`, channelError.message);
            }
        }

        return NextResponse.json({ success: true, syncedCount, failedCount });

    } catch (error: any) {
        console.error('Error syncing chat channels:', error);
        return NextResponse.json({ message: error.message || 'Internal server error' }, { status: 500 });
    }
}
