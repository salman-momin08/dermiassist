-- =====================================================
-- Enforce Email Uniqueness and Auto-Create Profiles
-- =====================================================
-- This migration prevents duplicate email signups and ensures
-- every auth user has a corresponding profile.

-- =====================================================
-- STEP 1: Check for Existing Duplicate Emails
-- =====================================================
DO $$
DECLARE
    duplicate_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO duplicate_count
    FROM (
        SELECT email, COUNT(*) as cnt
        FROM profiles
        GROUP BY email
        HAVING COUNT(*) > 1
    ) duplicates;
    
    IF duplicate_count > 0 THEN
        RAISE WARNING '⚠️  Found % duplicate email(s) in profiles table!', duplicate_count;
        RAISE WARNING 'Run this query to see duplicates:';
        RAISE WARNING 'SELECT email, COUNT(*) FROM profiles GROUP BY email HAVING COUNT(*) > 1;';
        RAISE WARNING 'Please clean up duplicates manually before proceeding.';
    ELSE
        RAISE NOTICE '✓ No duplicate emails found in profiles table.';
    END IF;
END $$;

-- =====================================================
-- STEP 2: Verify Email Unique Constraint
-- =====================================================
-- The unique constraint on email should already exist from the initial migration
-- This is just a verification step
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'profiles_email_key'
        AND conrelid = 'public.profiles'::regclass
    ) THEN
        -- Add unique constraint if it doesn't exist
        ALTER TABLE public.profiles
        ADD CONSTRAINT profiles_email_key UNIQUE (email);
        RAISE NOTICE '✓ Added unique constraint on profiles.email';
    ELSE
        RAISE NOTICE '✓ Unique constraint on profiles.email already exists';
    END IF;
END $$;

-- =====================================================
-- STEP 3: Email Existence Check Function
-- =====================================================
-- Function to check if an email already exists (for frontend validation)
CREATE OR REPLACE FUNCTION public.check_email_exists(check_email TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    email_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO email_count
    FROM public.profiles
    WHERE LOWER(email) = LOWER(check_email);
    
    RETURN email_count > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.check_email_exists IS 
    'Checks if an email already exists in the profiles table';

-- =====================================================
-- STEP 4: Create Index for Email Lookups
-- =====================================================
-- Create case-insensitive index for faster email lookups
CREATE INDEX IF NOT EXISTS idx_profiles_email_lower 
ON public.profiles (LOWER(email));

COMMENT ON INDEX idx_profiles_email_lower IS 
    'Case-insensitive index for email lookups';

-- =====================================================
-- STEP 5: Update RLS Policies
-- =====================================================
-- Drop the overly permissive policy if it exists
DROP POLICY IF EXISTS "Anyone can check email existence" ON profiles;

-- Keep existing policies intact, they should be sufficient
-- The email check will be done via the API endpoint with proper authentication

-- =====================================================
-- STEP 6: Add INSERT Policy for Profile Creation
-- =====================================================
-- Allow users to insert their own profile (needed for signup flow)
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
CREATE POLICY "Users can insert own profile" ON profiles
    FOR INSERT
    WITH CHECK (auth.uid() = id);

COMMENT ON POLICY "Users can insert own profile" ON profiles IS
    'Allows users to create their own profile during signup';

-- =====================================================
-- STEP 7: Sync Existing Auth Users
-- =====================================================
-- Create profiles for any auth users that don't have one
-- This uses a safe approach that checks for duplicates
DO $$
DECLARE
    sync_count INTEGER := 0;
    skip_count INTEGER := 0;
    auth_user RECORD;
BEGIN
    FOR auth_user IN 
        SELECT au.id, au.email, au.raw_user_meta_data
        FROM auth.users au
        LEFT JOIN public.profiles p ON au.id = p.id
        WHERE p.id IS NULL
    LOOP
        -- Check if email already exists in profiles
        IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE email = auth_user.email) THEN
            BEGIN
                INSERT INTO public.profiles (
                    id,
                    email,
                    role,
                    display_name,
                    created_at,
                    updated_at
                ) VALUES (
                    auth_user.id,
                    auth_user.email,
                    COALESCE(auth_user.raw_user_meta_data->>'role', 'patient'),
                    COALESCE(auth_user.raw_user_meta_data->>'full_name', ''),
                    NOW(),
                    NOW()
                );
                sync_count := sync_count + 1;
            EXCEPTION
                WHEN unique_violation THEN
                    RAISE WARNING '⚠️  Skipped duplicate email: %', auth_user.email;
                    skip_count := skip_count + 1;
            END;
        ELSE
            RAISE WARNING '⚠️  Auth user % has email % which already exists in profiles. Manual cleanup required.', 
                auth_user.id, auth_user.email;
            skip_count := skip_count + 1;
        END IF;
    END LOOP;
    
    IF sync_count > 0 THEN
        RAISE NOTICE '✓ Created % missing profile(s) for existing auth users', sync_count;
    ELSE
        RAISE NOTICE '✓ All auth users already have profiles';
    END IF;
    
    IF skip_count > 0 THEN
        RAISE WARNING '⚠️  Skipped % user(s) due to duplicate emails', skip_count;
    END IF;
END $$;

-- =====================================================
-- IMPORTANT: Manual Setup Required
-- =====================================================
-- Since we cannot create triggers on auth.users directly in hosted Supabase,
-- you need to set up automatic profile creation using one of these methods:
--
-- METHOD 1: Supabase Database Webhooks (Recommended)
-- 1. Go to your Supabase Dashboard → Database → Webhooks
-- 2. Create a new webhook for "auth.users" table on INSERT
-- 3. Point it to an Edge Function that creates the profile
--
-- METHOD 2: Handle in Application Code (Current Implementation)
-- The signup page now creates the profile immediately after auth signup
-- This is already implemented in src/app/(auth)/signup/page.tsx
--
-- METHOD 3: Supabase Auth Hooks (If available in your plan)
-- Use Supabase Auth Hooks to trigger profile creation on signup
-- =====================================================

-- =====================================================
-- Migration Complete
-- =====================================================
-- Summary:
-- ✓ Email uniqueness constraint verified
-- ✓ Email existence check function created
-- ✓ Existing auth users synced with profiles
-- ✓ Duplicate email prevention implemented at application level
-- ✓ RLS policies updated for profile insertion
--
-- Note: Profile auto-creation is handled by the signup page
-- since we cannot create triggers on auth.users in hosted Supabase
-- =====================================================
