-- =====================================================
-- 01 · profiles  (patients, doctors, admins)
-- =====================================================
-- Reconciles: 01_profiles_table, 08_email_uniqueness, 09_admin_rls_policies,
--             10_doctor_profile_fields, 11_documents_public_field,
--             12_delete_user_trigger, 13_add_signature_url, 16_policies_fix,
--             17_fix_doctor_columns, 32_rls_policy_fixes.
-- Depends on: 00 (update_updated_at_column).

CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Basic information
    email TEXT NOT NULL UNIQUE,
    role TEXT NOT NULL DEFAULT 'patient' CHECK (role IN ('patient', 'doctor', 'admin')),
    display_name TEXT,
    phone TEXT,

    -- Profile image
    photo_url TEXT,
    photo_public_id TEXT,

    -- Patient-specific fields
    dob DATE,
    gender TEXT CHECK (gender IN ('male', 'female', 'other', '')),
    blood_group TEXT,
    state TEXT,
    city TEXT,

    -- Doctor-specific fields
    specialization TEXT,
    bio TEXT,
    location TEXT,
    signature_url TEXT,
    signature_public_id TEXT,
    certificate_url TEXT,
    verified BOOLEAN DEFAULT FALSE,
    verification_pending BOOLEAN DEFAULT FALSE,
    education JSONB DEFAULT '[]'::jsonb,
    certificates JSONB DEFAULT '[]'::jsonb,
    testimonials JSONB DEFAULT '[]'::jsonb,
    years_of_experience INTEGER,
    languages TEXT[],
    consultation_fee TEXT,
    documents_public BOOLEAN DEFAULT FALSE,

    -- Subscription and preferences
    subscription_plan TEXT DEFAULT 'free',
    allow_data_sharing BOOLEAN DEFAULT TRUE,
    email_notifications BOOLEAN DEFAULT TRUE,

    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_email_lower ON profiles (LOWER(email));
CREATE INDEX IF NOT EXISTS idx_profiles_verified ON profiles(verified) WHERE role = 'doctor';
CREATE INDEX IF NOT EXISTS idx_profiles_verified_doctors
    ON profiles(role, verified) WHERE role = 'doctor' AND verified = TRUE;

-- ── Helper functions (defined after the table they read) ────────────────────
-- Admin check via SECURITY DEFINER to bypass RLS and avoid infinite recursion.
CREATE OR REPLACE FUNCTION public.is_admin(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles WHERE id = user_id AND role = 'admin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Case-insensitive email existence check for signup validation.
CREATE OR REPLACE FUNCTION public.check_email_exists(check_email TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    email_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO email_count
    FROM public.profiles WHERE LOWER(email) = LOWER(check_email);
    RETURN email_count > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Cascade a profile delete through to auth.users for complete account removal.
CREATE OR REPLACE FUNCTION delete_auth_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
    DELETE FROM auth.users WHERE id = OLD.id;
    RETURN OLD;
END;
$$;

-- Block non-admins from escalating their own role / verified flag.
CREATE OR REPLACE FUNCTION public.prevent_self_role_escalation()
RETURNS TRIGGER AS $$
BEGIN
    IF NOT public.is_admin(auth.uid()) THEN
        IF NEW.role IS DISTINCT FROM OLD.role OR NEW.verified IS DISTINCT FROM OLD.verified THEN
            RAISE EXCEPTION 'Only an admin can change role or verified status';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── Row Level Security ──────────────────────────────────────────────────────
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can view doctor profiles" ON profiles
    FOR SELECT USING (role = 'doctor' AND verified = TRUE);

CREATE POLICY "Admins can view all profiles" ON profiles
    FOR SELECT USING (public.is_admin(auth.uid()) OR auth.uid() = id);

CREATE POLICY "Admins can update all profiles" ON profiles
    FOR UPDATE USING (public.is_admin(auth.uid()))
    WITH CHECK (public.is_admin(auth.uid()));

-- NOTE: the "Doctors can view assigned patients" SELECT policy references
-- doctor_cases and appointments, so it is created at the end of
-- 05_doctor_cases.sql (after both tables exist).

-- ── Triggers ────────────────────────────────────────────────────────────────
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER on_profile_delete_trigger
    AFTER DELETE ON profiles
    FOR EACH ROW EXECUTE FUNCTION delete_auth_user();

CREATE TRIGGER trg_prevent_self_role_escalation
    BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION public.prevent_self_role_escalation();

GRANT ALL ON profiles TO authenticated;
GRANT ALL ON profiles TO service_role;
