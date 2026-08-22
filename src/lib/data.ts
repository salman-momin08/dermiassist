'use server';

import { createClient } from '@/lib/supabase/server';
import type { AnalysisReport } from "@/hooks/use-analyses";

export async function getAnalysesForUser(userId: string) {
    if (!userId) {
        throw new Error("User ID must be provided.");
    }

    const supabase = await createClient();
    const { data } = await supabase
        .from('analyses')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

    if (!data) return [];

    return data.map(item => ({
        id: item.id,
        conditionName: item.condition_name,
        date: item.created_at,
    }));
}


export async function getVerifiedDoctorsBySpecialization(specialization: string) {
    const supabase = await createClient();

    const { data: doctors, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'doctor')
        .eq('verified', true)
        .eq('specialization', specialization);

    if (error || !doctors) {
        console.error("Supabase Error in getVerifiedDoctorsBySpecialization: ", error);
        return [];
    }

    return doctors.map(doc => {
        return {
            id: doc.id,
            name: doc.display_name || "Dr. Anonymous",
            specialization: doc.specialization || "N/A",
            location: doc.location || "N/A",
            avatar: doc.photo_url || `https://placehold.co/100x100.png?text=${(doc.display_name || 'D').charAt(0)}`,
        };
    });
}
