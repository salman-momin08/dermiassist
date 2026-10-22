"use server";

/**
 * @fileOverview Server action for releasing a doctor-reviewed clinical case.
 *
 * `REPORT_SIGNING_SECRET` is a server-only HMAC secret (see .env.example) and
 * must never be readable from a client component. The doctor case-review page
 * (`src/app/doctor/cases/[id]/page.tsx`) previously wrote the release fields
 * directly to Supabase from the browser via the anon client. That still works
 * for the plain fields (protected by RLS), but computing the QR-verification
 * signature requires the secret, so that specific write is done here instead,
 * as a small Server Action the client calls in place of a direct Supabase
 * `.update()`.
 *
 * The signature covers `${analysisId}:${reviewStatus}:${reviewedAt}` — this
 * exact colon-joined string format must match byte-for-byte what
 * `src/app/verify-report/[id]/page.tsx` recomputes on the read side, or
 * verification will always fail.
 */

import crypto from 'crypto';
import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';
import type { ClinicianOverrides } from '@/types/review-types';
import { z } from 'zod';

export interface ReleaseCaseReportInput {
    analysisId: string;
    reviewerNotes: string;
    overrides: ClinicianOverrides;
}

export type ReleaseCaseReportResult =
    | { success: true; reviewedAt: string }
    | { success: false; message: string };

const ReleaseCaseReportSchema = z.object({
    analysisId: z.string().uuid(),
    reviewerNotes: z.string().max(20000),
    overrides: z.object({
        conditionName: z.string().trim().min(1).max(500),
        condition: z.string().max(20000).optional(),
        recommendations: z.string().max(20000),
        dos: z.array(z.string().max(2000)).max(100),
        donts: z.array(z.string().max(2000)).max(100),
        icd10Code: z.string().max(30),
        severity: z.string().trim().min(1).max(100),
        otherConsiderations: z.string().max(20000).optional(),
        biopsyOrdered: z.boolean().optional(),
    }),
});

export async function releaseCaseReport(
    input: ReleaseCaseReportInput
): Promise<ReleaseCaseReportResult> {
    const parsed = ReleaseCaseReportSchema.safeParse(input);
    if (!parsed.success) {
        return { success: false, message: 'Invalid clinical review fields.' };
    }
    input = parsed.data;
    const secret = process.env.REPORT_SIGNING_SECRET;
    if (!secret) {
        // Honest failure: never release a case with an unsigned/forgeable
        // verification record just because the secret is missing.
        logger.error('case_review.release.missing_secret', { analysisId: input.analysisId });
        return { success: false, message: 'Report signing is not configured on the server (REPORT_SIGNING_SECRET missing).' };
    }

    if (!input.analysisId) {
        return { success: false, message: 'Missing analysisId.' };
    }

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
        return { success: false, message: 'Unauthorized: you must be signed in to release a case.' };
    }

    const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role, verified, display_name')
        .eq('id', user.id)
        .single();

    if (profileError || !profile || profile.role !== 'doctor' || !profile.verified || !profile.display_name) {
        return { success: false, message: 'Only a verified doctor with a completed profile may release a clinical case.' };
    }

    const reviewStatus = 'released';
    const reviewedAt = new Date().toISOString();

    // Signature input MUST match the recomputation in verify-report/[id]/page.tsx exactly.
    const signature = crypto
        .createHmac('sha256', secret)
        .update(`${input.analysisId}:${reviewStatus}:${reviewedAt}`)
        .digest('hex');

    const { data: released, error } = await supabase
        .from('analyses')
        .update({
            review_status: reviewStatus,
            reviewer_id: user.id,
            reviewer_name: profile.display_name,
            reviewer_badge: null,
            reviewer_notes: input.reviewerNotes,
            clinician_overrides: input.overrides,
            reviewed_at: reviewedAt,
            verification_signature: signature,
        })
        .eq('id', input.analysisId)
        .select('id')
        .single();

    if (error || !released) {
        logger.error('case_review.release.failed', {
            analysisId: input.analysisId,
            error: error?.message ?? 'No report was updated',
        });
        return { success: false, message: 'Report could not be released. Confirm that the case exists and is assigned to you.' };
    }

    logger.info('case_review.release.success', { analysisId: input.analysisId, reviewedAt });

    return { success: true, reviewedAt };
}
