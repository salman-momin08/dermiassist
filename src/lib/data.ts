'use server';

import { createClient } from '@/lib/supabase/server';

export async function getAnalysesForUser(userId: string) {
    if (!userId) {
        throw new Error("User ID must be provided.");
    }

    const supabase = await createClient();
    const { data, error } = await supabase
        .from('analyses')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

    // A real query failure must not be masked as "no history".
    if (error) {
        console.error('Supabase Error in getAnalysesForUser: ', error);
        throw new Error(`Failed to load analyses: ${error.message}`);
    }

    // No error + no rows is a legitimate empty history.
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
        .select('id, display_name, specialization, location, photo_url')
        .eq('role', 'doctor')
        .eq('verified', true)
        .eq('specialization', specialization);

    // Distinguish a real query failure from a legitimate empty result so a
    // datastore outage is not silently shown to a patient as "no doctors".
    if (error) {
        console.error("Supabase Error in getVerifiedDoctorsBySpecialization: ", error);
        throw new Error(`Failed to load doctors: ${error.message}`);
    }

    if (!doctors) return [];

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
