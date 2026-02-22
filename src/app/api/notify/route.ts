import { NextRequest, NextResponse } from 'next/server';
import { novu } from '@/lib/novu/client';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * POST /api/notify
 * General-purpose server-side notification trigger.
 * Called from client-side pages to avoid exposing NOVU_API_SECRET in the browser.
 *
 * Body: { workflowId, subscriberId, email?, firstName?, payload? }
 * If email is not provided, it is auto-fetched from the profiles table.
 */
export async function POST(request: NextRequest) {
    try {
        // Verify user is authenticated
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { workflowId, subscriberId, payload } = body;
        let { email, firstName } = body;

        if (!workflowId || !subscriberId) {
            return NextResponse.json({ message: 'Missing workflowId or subscriberId' }, { status: 400 });
        }

        // Auto-lookup email and name from profiles if not provided
        if (!email) {
            const { data: profile } = await supabase
                .from('profiles')
                .select('email, display_name')
                .eq('id', subscriberId)
                .single();

            if (profile?.email) {
                email = profile.email;
            }
            if (!firstName && profile?.display_name) {
                firstName = profile.display_name.split(' ')[0];
            }
        }

        await novu.trigger(workflowId, {
            to: {
                subscriberId,
                ...(email && { email }),
                ...(firstName && { firstName }),
            },
            payload: payload || {},
        });

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Novu trigger error:', error);
        return NextResponse.json({ message: error.message || 'Failed to send notification' }, { status: 500 });
    }
}
