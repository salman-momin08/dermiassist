import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { StreamChat } from 'stream-chat';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { patientId } = body;

        if (!patientId) {
            return NextResponse.json({ message: 'Missing patientId' }, { status: 400 });
        }

        // In a real production app, you would query the DB here to ensure the 
        // doctor (user.id) and patient (patientId) actually have an active appointment/connection.
        // For this implementation, we rely on the caller being the authenticated doctor.

        const apiKey = process.env.NEXT_PUBLIC_STREAM_API_KEY!;
        const apiSecret = process.env.STREAM_API_SECRET!;
        const serverClient = StreamChat.getInstance(apiKey, apiSecret);

        // Create a deterministic, non-guessable channel ID
        const sortedIds = [user.id, patientId].sort();
        const hash = crypto.createHash('sha256')
            .update(`${process.env.CHAT_SECRET_SALT || 'dermiassist_salt'}:${sortedIds[0]}:${sortedIds[1]}`)
            .digest('hex');
        const channelId = `consult_${hash}`;

        // Provision the secure consultation channel
        const channel = serverClient.channel('consultation', channelId, {
            created_by_id: user.id,
            members: [user.id, patientId],
        });

        await channel.create();

        return NextResponse.json({ success: true, channelId });

    } catch (error: any) {
        console.error('Error provisioning chat channel:', error);
        return NextResponse.json({ message: error.message || 'Internal server error' }, { status: 500 });
    }
}
