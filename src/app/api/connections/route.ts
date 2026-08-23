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
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();

        // Check if this is a fetch request or create request
        if (body.action === 'fetch') {
            const { role } = body;

            if (!role) {
                return NextResponse.json({ message: 'Missing role' }, { status: 400 });
            }

            // Only allow fetching connections where the authenticated user is the party.
            // Never trust a body-supplied userId for someone else.
            let query = supabase.from('connection_requests').select('*');

            if (role === 'doctor') {
                query = query.eq('doctor_id', user.id);
            } else {
                query = query.eq('patient_id', user.id);
            }

            const { data, error } = await query;

            if (error) {
                return NextResponse.json({ message: error.message }, { status: 500 });
            }

            return NextResponse.json({ data });
        }

        // Create connection request. The authenticated user is always the patient
        // (matches the RLS policy: insert allowed only when auth.uid() = patient_id).
        // Derive patientId from the session so a user cannot forge requests for others.
        const { doctorId } = body;
        const patientId = user.id;

        if (!doctorId) {
            return NextResponse.json({ message: 'Missing doctorId' }, { status: 400 });
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
            const [{ data: doctorProfile }, { data: patientProfile }] = await Promise.all([
                supabase
                    .from('profiles')
                    .select('email, display_name')
                    .eq('id', doctorId)
                    .single(),
                supabase
                    .from('profiles')
                    .select('display_name')
                    .eq('id', patientId)
                    .single(),
            ]);

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
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
        }

        const { requestId, status } = await request.json();

        if (!requestId || !['accepted', 'rejected'].includes(status)) {
            return NextResponse.json({ message: 'Invalid request' }, { status: 400 });
        }

        // 0. Verify the authenticated user is the doctor party to this specific
        //    request before mutating its status or provisioning a Stream channel.
        const { data: existing, error: fetchError } = await supabase
            .from('connection_requests')
            .select('doctor_id')
            .eq('id', requestId)
            .single();

        if (fetchError || !existing) {
            return NextResponse.json({ message: 'Connection request not found' }, { status: 404 });
        }

        if (existing.doctor_id !== user.id) {
            return NextResponse.json({ message: 'Forbidden: Only the recipient doctor can respond to this request' }, { status: 403 });
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
            const serverClient = StreamChat.getInstance(apiKey, apiSecret, {
                timeout: 15000,
            });

            // Create a deterministic, non-guessable channel ID
            const sortedIds = [connection.doctor_id, connection.patient_id].sort();
            const hash = crypto.createHash('sha256')
                .update(`${process.env.CHAT_SECRET_SALT || 'dermiassist_salt'}:${sortedIds[0]}:${sortedIds[1]}`)
                .digest('hex');
            // Stream Chat max 64 chars: "consult_" (8) + 48 hex = 56 total
            const channelId = `consult_${hash.substring(0, 48)}`;

            const channel = serverClient.channel('messaging', channelId, {
                members: [connection.patient_id, connection.doctor_id],
                created_by_id: connection.doctor_id
            });
            await channel.create();
        }

        // 3. Notify patient of the response
        try {
            const [{ data: patientProfile }, { data: doctorProfile }] = await Promise.all([
                supabase
                    .from('profiles')
                    .select('email, display_name')
                    .eq('id', connection.patient_id)
                    .single(),
                supabase
                    .from('profiles')
                    .select('display_name')
                    .eq('id', connection.doctor_id)
                    .single(),
            ]);

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
