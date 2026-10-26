"use server";

import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

export interface PatientHistoryEntry {
    id: string;
    kind: 'consultation' | 'case' | 'analysis';
    occurredAt: string;
    status: string;
    title: string;
    doctor: { id: string; name: string; specialization: string | null; photoUrl: string | null } | null;
    details: { label: string; value: string }[];
}

export interface PatientHistory {
    patient: { id: string; name: string };
    entries: PatientHistoryEntry[];
    hasMore: boolean;
}

export type PatientHistoryResult =
    | { success: true; history: PatientHistory }
    | { success: false; message: string };

const HistoryRequestSchema = z.object({
    patientId: z.string().uuid().optional(),
    page: z.number().int().min(0).max(100000).default(0),
});

export async function getPatientHistory(
    input: { patientId?: string; page?: number } = {}
): Promise<PatientHistoryResult> {
    const parsed = HistoryRequestSchema.safeParse(input);
    if (!parsed.success) {
        return { success: false, message: 'Enter a valid patient UUID.' };
    }

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
        return { success: false, message: 'Sign in to view patient history.' };
    }

    const { data, error } = await supabase.rpc('get_patient_history', {
        target_patient_id: parsed.data.patientId ?? user.id,
        page_number: parsed.data.page,
    });
    if (error || !data) {
        return { success: false, message: 'History is unavailable. Confirm the UUID and your access, or contact an administrator.' };
    }

    return { success: true, history: data as PatientHistory };
}