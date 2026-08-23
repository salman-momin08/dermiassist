import { NextRequest, NextResponse } from 'next/server';
import { novu } from '@/lib/novu/client';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * POST /api/notify
 * Server-side notification trigger.
 * Called from client-side pages to avoid exposing NOVU_API_SECRET in the browser.
 *
 * Body: { workflowId, subscriberId, email?, firstName?, payload? }
 * If email is not provided, it is auto-fetched from the profiles table.
 *
 * SECURITY: The workflowId must be one of a fixed server-side allowlist, and the
 * authenticated caller must be authorized to notify the target `subscriberId` for
 * that specific workflow. This prevents impersonation, phishing, and email
 * disclosure via arbitrary client-supplied workflow/subscriber combinations.
 * A caller may always notify themselves.
 */
type NotifyContext = {
    supabase: Awaited<ReturnType<typeof createClient>>;
    userId: string;
    subscriberId: string;
};

const ALLOWED_WORKFLOWS: Record<string, (ctx: NotifyContext) => Promise<boolean>> = {
    // A doctor notifies a patient they share an appointment with.
    'appointment-confirmed': isDoctorForPatient,
    'appointment-declined': isDoctorForPatient,
    // Only admins may notify a user about a role-change decision.
    'role-change-approved': isAdmin,
    'role-change-rejected': isAdmin,
};

async function isDoctorForPatient({ supabase, userId, subscriberId }: NotifyContext): Promise<boolean> {
    const { data, error } = await supabase
        .from('appointments')
        .select('id')
        .eq('doctor_id', userId)
        .eq('patient_id', subscriberId)
        .limit(1)
        .maybeSingle();
    return !error && !!data;
}

async function isAdmin({ supabase, userId }: NotifyContext): Promise<boolean> {
    const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single();
    return !error && data?.role === 'admin';
}

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

        // Authorize the (caller, workflow, target) triple.
        // A caller may always notify themselves; otherwise the workflow must be on
        // the allowlist and the per-workflow authorization check must pass.
        if (subscriberId !== user.id) {
            const authorize = ALLOWED_WORKFLOWS[workflowId];
            if (!authorize) {
                return NextResponse.json({ message: 'Forbidden: unknown or disallowed workflow' }, { status: 403 });
            }
            const allowed = await authorize({ supabase, userId: user.id, subscriberId });
            if (!allowed) {
                return NextResponse.json({ message: 'Forbidden: not authorized to notify this recipient' }, { status: 403 });
            }
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
