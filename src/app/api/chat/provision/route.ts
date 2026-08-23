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

        // Confirm the caller is a verified doctor.
        const { data: callerProfile, error: profileError } = await supabase
            .from('profiles')
            .select('role, verified')
            .eq('id', user.id)
            .single();

        if (profileError || !callerProfile || callerProfile.role !== 'doctor' || !callerProfile.verified) {
            return NextResponse.json(
                { message: 'Forbidden: Only verified doctors can provision consultation channels' },
                { status: 403 }
            );
        }

        // Confirm an ACCEPTED connection exists between this doctor and the target patient
        // before creating/joining the channel.
        const { data: connection, error: connectionError } = await supabase
            .from('connection_requests')
            .select('id')
            .eq('doctor_id', user.id)
            .eq('patient_id', patientId)
            .eq('status', 'accepted')
            .maybeSingle();

        if (connectionError) {
            return NextResponse.json({ message: connectionError.message }, { status: 500 });
        }

        if (!connection) {
            return NextResponse.json(
                { message: 'Forbidden: No accepted connection with this patient' },
                { status: 403 }
            );
        }

        const apiKey = process.env.NEXT_PUBLIC_STREAM_API_KEY!;
        const apiSecret = process.env.STREAM_API_SECRET!;
        const serverClient = StreamChat.getInstance(apiKey, apiSecret, {
            timeout: 15000,
        });

        // Create a deterministic, non-guessable channel ID
        const sortedIds = [user.id, patientId].sort();
        const hash = crypto.createHash('sha256')
            .update(`${process.env.CHAT_SECRET_SALT || 'dermiassist_salt'}:${sortedIds[0]}:${sortedIds[1]}`)
            .digest('hex');
        // Stream Chat max 64 chars: "consult_" (8) + 48 hex = 56 total
        const channelId = `consult_${hash.substring(0, 48)}`;

        // Provision the secure consultation channel
        const channel = serverClient.channel('messaging', channelId, {
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
