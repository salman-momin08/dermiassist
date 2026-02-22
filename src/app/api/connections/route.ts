import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { StreamChat } from 'stream-chat';
import { novu } from '@/lib/novu/client';
import { RateLimitMiddleware } from '@/lib/redis/middleware';

export const dynamic = 'force-dynamic';

const apiKey = process.env.NEXT_PUBLIC_STREAM_API_KEY!;
const apiSecret = process.env.STREAM_API_SECRET!;

/**
 * POST /api/connections - Create a new connection request
 */
export const POST = RateLimitMiddleware.strict(async (request: NextRequest) => {
    try {
        const supabase = await createClient();
        const body = await request.json();

        // Check if this is a fetch request or create request
        if (body.action === 'fetch') {
            const { userId, role } = body;

            if (!userId || !role) {
                return NextResponse.json({ message: 'Missing userId or role' }, { status: 400 });
            }

            let query = supabase.from('connection_requests').select('*');

            if (role === 'doctor') {
                query = query.eq('doctor_id', userId);
            } else {
                query = query.eq('patient_id', userId);
            }

            const { data, error } = await query;

            if (error) {
                return NextResponse.json({ message: error.message }, { status: 500 });
            }

            return NextResponse.json({ data });
        }

        // Create connection request
        const { doctorId, patientId } = body;

        if (!doctorId || !patientId) {
            return NextResponse.json({ message: 'Missing doctorId or patientId' }, { status: 400 });
        }

        const { data, error } = await supabase
            .from('connection_requests')
            .insert({
                doctor_id: doctorId,
                patient_id: patientId,
                status: 'pending'
            })
            .select()
            .single();

        if (error) {
            if (error.code === '23505') { // Unique violation
                return NextResponse.json({ message: 'Request already exists' }, { status: 409 });
            }
            throw error;
        }

        // Notify doctor of new connection request
        try {
            const { data: doctorProfile } = await supabase
                .from('profiles')
                .select('email, display_name')
                .eq('id', doctorId)
                .single();

            const { data: patientProfile } = await supabase
                .from('profiles')
                .select('display_name')
                .eq('id', patientId)
                .single();

            await novu.trigger('connection-request', {
                to: {
                    subscriberId: doctorId,
                    ...(doctorProfile?.email && { email: doctorProfile.email }),
                    ...(doctorProfile?.display_name && { firstName: doctorProfile.display_name }),
                },
                payload: {
                    patientName: patientProfile?.display_name || 'A patient',
                },
            });
        } catch (notifError) {
            // Non-fatal: log but don't fail the request
            console.error('Failed to send connection-request notification:', notifError);
        }

        return NextResponse.json({ success: true, data });
    } catch (error: any) {
        console.error('Error with connection request:', error);
        return NextResponse.json({ message: error.message || 'Internal Error' }, { status: 500 });
    }
});

/**
 * PATCH /api/connections - Update connection request status
 */
export const PATCH = RateLimitMiddleware.strict(async (request: NextRequest) => {
    try {
        const supabase = await createClient();
        const { requestId, status } = await request.json();

        if (!requestId || !['accepted', 'rejected'].includes(status)) {
            return NextResponse.json({ message: 'Invalid request' }, { status: 400 });
        }

        // 1. Update the request status
        const { data: connection, error } = await supabase
            .from('connection_requests')
            .update({ status })
            .eq('id', requestId)
            .select()
            .single();

        if (error) throw error;

        // 2. If accepted, initialize Stream Chat Channel
        if (status === 'accepted') {
            const crypto = require('crypto');
            const serverClient = StreamChat.getInstance(apiKey, apiSecret);

            // Create a deterministic, non-guessable channel ID
            const sortedIds = [connection.doctor_id, connection.patient_id].sort();
            const hash = crypto.createHash('sha256')
                .update(`${process.env.CHAT_SECRET_SALT || 'dermiassist_salt'}:${sortedIds[0]}:${sortedIds[1]}`)
                .digest('hex');
            const channelId = `consult_${hash}`;

            const channel = serverClient.channel('consultation', channelId, {
                members: [connection.patient_id, connection.doctor_id],
                created_by_id: connection.doctor_id
            });
            await channel.create();
        }

        // 3. Notify patient of the response
        try {
            const { data: patientProfile } = await supabase
                .from('profiles')
                .select('email, display_name')
                .eq('id', connection.patient_id)
                .single();

            const { data: doctorProfile } = await supabase
                .from('profiles')
                .select('display_name')
                .eq('id', connection.doctor_id)
                .single();

            await novu.trigger('connection-response', {
                to: {
                    subscriberId: connection.patient_id,
                    ...(patientProfile?.email && { email: patientProfile.email }),
                    ...(patientProfile?.display_name && { firstName: patientProfile.display_name }),
                },
                payload: {
                    doctorName: doctorProfile?.display_name || 'Your doctor',
                    status: status === 'accepted' ? 'accepted' : 'declined',
                },
            });
        } catch (notifError) {
            console.error('Failed to send connection-response notification:', notifError);
        }

        return NextResponse.json({ success: true, data: connection });

    } catch (error: any) {
        console.error('Error updating connection request:', error);
        return NextResponse.json({ message: error.message || 'Internal Error' }, { status: 500 });
    }
});
