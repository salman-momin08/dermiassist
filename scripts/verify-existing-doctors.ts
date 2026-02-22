import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env file
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
    console.error('❌ Missing Supabase environment variables');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

async function verifyExistngDoctors() {
    console.log('🔍 Searching for unverified doctors...');

    // 1. Fetch all profiles with role 'doctor' and verified false
    const { data: doctors, error: fetchError } = await supabase
        .from('profiles')
        .select('id, email, display_name, verified, verification_pending')
        .eq('role', 'doctor')
        .eq('verified', false);

    if (fetchError) {
        console.error('❌ Error fetching doctors:', fetchError);
        return;
    }

    if (!doctors || doctors.length === 0) {
        console.log('✅ No unverified doctors found.');
        return;
    }

    console.log(`Found ${doctors.length} unverified doctors. Starting verification...`);

    // 2. Update each doctor
    for (const doctor of doctors) {
        console.log(`Verifying: ${doctor.display_name || doctor.email} (${doctor.id})...`);

        const { error: updateError } = await supabase
            .from('profiles')
            .update({
                verified: true,
                verification_pending: false
            })
            .eq('id', doctor.id);

        if (updateError) {
            console.error(`❌ Failed to verify ${doctor.id}:`, updateError);
        } else {
            console.log(`✅ Successfully verified ${doctor.id}`);
        }
    }

    console.log('🏁 Verification process complete.');
}

verifyExistngDoctors();
