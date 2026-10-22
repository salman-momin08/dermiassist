import type { AnalysisReport } from '@/hooks/use-analyses';
import type { ClinicianOverrides, ReviewStatus } from '@/types/review-types';

export interface AnalysisRow {
    id: string;
    user_id: string;
    user_name?: string | null;
    condition_name: string;
    condition_description?: string | null;
    created_at: string;
    severity?: string | null;
    image?: string | null;
    image_url?: string | null;
    recommendations?: string | null;
    dos?: string[] | null;
    donts?: string[] | null;
    submitted_info?: AnalysisReport['submittedInfo'] | null;
    explanations?: AnalysisReport['explanations'] | null;
    review_status?: ReviewStatus | null;
    reviewer_id?: string | null;
    reviewer_name?: string | null;
    reviewer_badge?: string | null;
    reviewer_badge_number?: string | null;
    reviewer_notes?: string | null;
    clinician_overrides?: ClinicianOverrides | null;
    reviewed_at?: string | null;
    confidence_score?: number | string | null;
    icd10_code?: string | null;
    verification_signature?: string | null;
}

export function mapAnalysisRow(item: AnalysisRow): AnalysisReport {
    const overrides = item.review_status === 'released' ? item.clinician_overrides : null;
    const confidence = item.confidence_score == null ? undefined : Number(item.confidence_score);
    return {
        id: item.id,
        userId: item.user_id,
        userName: item.user_name ?? '',
        conditionName: overrides?.conditionName ?? item.condition_name,
        condition: overrides?.condition ?? item.condition_description ?? item.condition_name,
        date: item.created_at,
        severity: overrides?.severity ?? item.severity ?? 'Not assessed',
        image: item.image ?? item.image_url ?? '',
        recommendations: overrides?.recommendations ?? item.recommendations ?? '',
        dos: overrides?.dos ?? item.dos ?? [],
        donts: overrides?.donts ?? item.donts ?? [],
        submittedInfo: item.submitted_info ?? {},
        explanations: item.explanations ?? undefined,
        reviewStatus: item.review_status ?? 'pending_review',
        reviewerId: item.reviewer_id ?? undefined,
        reviewerName: item.reviewer_name ?? undefined,
        reviewerBadgeNumber: item.reviewer_badge ?? item.reviewer_badge_number ?? undefined,
        reviewerNotes: item.reviewer_notes ?? undefined,
        clinicianOverrides: item.clinician_overrides ?? undefined,
        reviewedAt: item.reviewed_at ?? undefined,
        confidenceScore: confidence !== undefined && Number.isFinite(confidence) && confidence >= 0 && confidence <= 100
            ? confidence : undefined,
        icd10Code: overrides?.icd10Code ?? item.icd10_code ?? undefined,
        verificationSignature: item.verification_signature ?? undefined,
    };
}
