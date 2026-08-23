/**
 * @fileOverview Executable Medical Agent Tools (Function Calling).
 * Provides actionable tools for AI agents and MCP clients:
 * 1. Drug Interaction & Safety Checker
 * 2. Doctor Appointment Slot Finder
 * 3. Clinical Severity Index Calculator
 */

import { z } from 'zod';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';

// ── TOOL 1: DRUG INTERACTION CHECKER ────────────────────────────

export const DrugInteractionInputSchema = z.object({
    topicalMedication: z.string().describe('Topical medication name (e.g. Adapalene, Tretinoin, Benzoyl Peroxide).'),
    oralMedication: z.string().optional().describe('Oral medication name (e.g. Doxycycline, Isotretinoin, Oral Steroids).'),
});

export interface DrugInteractionResult {
    // `null` = not assessed / unknown. We must never assert `true` (safe) for a
    // combination that was not actually checked against a known rule or database.
    safeToCombine: boolean | null;
    interactionRiskLevel: 'none' | 'moderate' | 'severe' | 'potential' | 'unknown';
    warningMessage: string;
    recommendedSpacingHours?: number;
    sources?: string[];
}

/**
 * Executable Tool: Check drug interactions between topical and oral skin medications.
 *
 * Primary path: the Python service (curated contraindications + live openFDA drug
 * labeling). If that service is unreachable, we fall back to the local curated
 * rules below and otherwise return an honest "not assessed" — never a false "safe".
 */
export async function checkDrugInteractionsTool(
    input: z.infer<typeof DrugInteractionInputSchema>
): Promise<DrugInteractionResult> {
    const topical = input.topicalMedication.toLowerCase();
    const oral = (input.oralMedication || '').toLowerCase();

    logger.info('tool.drug_interaction.executed', { topical, oral });

    // Primary: real-time Python engine (curated rules + openFDA labels).
    try {
        const fastApiUrl = process.env.PYTHON_AI_SERVICE_URL || process.env.FASTAPI_SERVICE_URL || 'http://localhost:8000';
        const resp = await fetch(`${fastApiUrl}/api/v1/tools/drug-interaction`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-internal-api-key': process.env.PYTHON_AI_SERVICE_API_KEY || '',
            },
            body: JSON.stringify({ topical_medication: input.topicalMedication, oral_medication: input.oralMedication }),
            signal: AbortSignal.timeout(12000),
        });
        if (resp.ok) {
            const d = await resp.json();
            return {
                safeToCombine: d.safe_to_combine ?? null,
                interactionRiskLevel: d.interaction_risk_level ?? 'unknown',
                warningMessage: d.warning_message,
                recommendedSpacingHours: d.recommended_spacing_hours ?? undefined,
                sources: d.sources ?? [],
            };
        }
    } catch (err) {
        logger.warn('tool.drug_interaction.python_unavailable', { error: err instanceof Error ? err.message : String(err) });
    }
    // Fallback: local curated rules only (below).

    // Severe Contraindication: Oral Isotretinoin + Oral Tetracyclines (Doxycycline) -> Pseudotumor Cerebri
    if (oral.includes('isotretinoin') && (oral.includes('doxycycline') || oral.includes('tetracycline'))) {
        return {
            safeToCombine: false,
            interactionRiskLevel: 'severe',
            warningMessage: 'CRITICAL CONTRAINDICATION: Combining oral isotretinoin with tetracyclines/doxycycline carries high risk of benign intracranial hypertension (pseudotumor cerebri). Do NOT combine.',
        };
    }

    // Moderate Risk: Benzoyl Peroxide + Tretinoin applied at exact same time -> Oxidation degradation
    if (topical.includes('benzoyl') && topical.includes('tretinoin')) {
        return {
            safeToCombine: true,
            interactionRiskLevel: 'moderate',
            warningMessage: 'Benzoyl peroxide can oxidize and deactivate tretinoin if applied simultaneously. Apply benzoyl peroxide in the morning and tretinoin at night.',
            recommendedSpacingHours: 12,
        };
    }

    // Moderate Risk: Multiple strong exfoliants (Salicylic Acid + Adapalene) -> Severe barrier breakdown
    if (topical.includes('salicylic') && (topical.includes('adapalene') || topical.includes('retinoid'))) {
        return {
            safeToCombine: true,
            interactionRiskLevel: 'moderate',
            warningMessage: 'Combining salicylic acid with topical retinoids can cause severe dryness and skin barrier irritation. Alternate days of use.',
            recommendedSpacingHours: 24,
        };
    }

    // Unrecognized combination: the built-in rule set only covers a small number of
    // known interactions. Asserting "safe" here would be a false safety claim, so we
    // return an explicit "not assessed" result instead.
    return {
        safeToCombine: null,
        interactionRiskLevel: 'unknown',
        warningMessage: 'This medication combination is not covered by the built-in interaction rules and has NOT been assessed for safety. Do not assume it is safe to combine — please consult a pharmacist or the prescribing clinician.',
    };
}

// ── TOOL 2: DOCTOR AVAILABILITY FINDER ─────────────────────────

export const DoctorAvailabilityInputSchema = z.object({
    specialty: z.string().optional().describe('Filter by specialty (e.g. General Dermatology, Pediatric Dermatology).'),
    city: z.string().optional().describe('Filter by city or location.'),
});

export interface DoctorSlotResult {
    doctorId: string;
    doctorName: string;
    specialization: string;
    location: string;
    // `null` = availability was not queried. The `profiles` table does not store
    // appointment slots, so we do not synthesize a date that was never looked up.
    nextAvailableSlot: string | null;
}

/**
 * Executable Tool: Query database for available verified doctors and open appointment slots.
 */
export async function queryDoctorAvailabilityTool(
    input: z.infer<typeof DoctorAvailabilityInputSchema>
): Promise<{ doctors: DoctorSlotResult[]; error?: string }> {
    logger.info('tool.doctor_availability.executed', input);

    try {
        const supabase = await createServerClient();
        let query = supabase
            .from('profiles')
            .select('id, display_name, specialization, city, location')
            .eq('role', 'doctor')
            .eq('verified', true)
            .limit(5);

        if (input.city) {
            query = query.ilike('city', `%${input.city}%`);
        }

        const { data, error } = await query;

        if (error) {
            // Surface the real DB error instead of synthesizing fake doctors.
            logger.error('tool.doctor_availability.db_error', { error: error.message });
            return { doctors: [], error: error.message };
        }

        const doctors: DoctorSlotResult[] = (data ?? []).map((doc) => ({
            doctorId: doc.id,
            doctorName: doc.display_name || 'Verified Dermatologist',
            specialization: doc.specialization || 'General Dermatology',
            location: doc.location || doc.city || 'Online Consultation',
            // Availability is not stored in `profiles`; do not synthesize a slot date.
            nextAvailableSlot: null,
        }));

        return { doctors };
    } catch (err) {
        // On failure, return an empty list and surface the error — never fabricate
        // doctors or appointment slots that were never queried.
        const message = err instanceof Error ? err.message : String(err);
        logger.error('tool.doctor_availability.failed', { error: message });
        return { doctors: [], error: message };
    }
}
