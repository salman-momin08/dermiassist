-- =====================================================
-- Profiles Table Migration
-- =====================================================
-- This migration creates the profiles table for storing user information
-- including patients, doctors, and admins with role-based fields.

-- Create profiles table
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
    
    -- Subscription and preferences
    subscription_plan TEXT DEFAULT 'free',
    allow_data_sharing BOOLEAN DEFAULT TRUE,
    email_notifications BOOLEAN DEFAULT TRUE,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_verified ON profiles(verified) WHERE role = 'doctor';

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can view doctor profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON profiles;

-- Users can view their own profile
CREATE POLICY "Users can view own profile" ON profiles
    FOR SELECT
    USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile" ON profiles
    FOR UPDATE
    USING (auth.uid() = id);

-- Anyone can view doctor profiles (for doctor listings)
CREATE POLICY "Users can view doctor profiles" ON profiles
    FOR SELECT
    USING (role = 'doctor' AND verified = TRUE);

-- Admins can view all profiles
CREATE POLICY "Admins can view all profiles" ON profiles
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles p
            WHERE p.id = auth.uid()
            AND p.role = 'admin'
        )
    );

-- Admins can update all profiles
CREATE POLICY "Admins can update all profiles" ON profiles
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM profiles p
            WHERE p.id = auth.uid()
            AND p.role = 'admin'
        )
    );

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update updated_at on profile changes
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add table and column comments
COMMENT ON TABLE profiles IS 'User profiles for patients, doctors, and admins';
COMMENT ON COLUMN profiles.role IS 'User role: patient, doctor, or admin';
COMMENT ON COLUMN profiles.verified IS 'Doctor verification status';
COMMENT ON COLUMN profiles.subscription_plan IS 'User subscription tier';

-- =====================================================
-- Migration Complete
-- =====================================================
-- =====================================================
-- Analyses Table Migration
-- =====================================================
-- This migration creates the analyses table for storing
-- AI skin analysis results and reports.

-- Create analyses table
CREATE TABLE IF NOT EXISTS analyses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- User reference
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    
    -- Analysis details
    condition_name TEXT NOT NULL,
    severity TEXT,
    confidence_score DECIMAL(5,2),
    
    -- Image data
    image_url TEXT NOT NULL,
    image_public_id TEXT,
    
    -- AI Report data (stored as JSON)
    report_data JSONB,
    
    -- Analysis metadata
    date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_analyses_user ON analyses(user_id);
CREATE INDEX IF NOT EXISTS idx_analyses_date ON analyses(date DESC);
CREATE INDEX IF NOT EXISTS idx_analyses_condition ON analyses(condition_name);

-- Enable Row Level Security
ALTER TABLE analyses ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own analyses" ON analyses;
DROP POLICY IF EXISTS "Users can create analyses" ON analyses;
DROP POLICY IF EXISTS "Users can delete own analyses" ON analyses;
DROP POLICY IF EXISTS "Doctors can view patient analyses" ON analyses;
DROP POLICY IF EXISTS "Admins can view all analyses" ON analyses;

-- Users can view their own analyses
CREATE POLICY "Users can view own analyses" ON analyses
    FOR SELECT
    USING (auth.uid() = user_id);

-- Users can create their own analyses
CREATE POLICY "Users can create analyses" ON analyses
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Users can delete their own analyses
CREATE POLICY "Users can delete own analyses" ON analyses
    FOR DELETE
    USING (auth.uid() = user_id);

-- Doctors can view analyses of their patients (through appointments)
CREATE POLICY "Doctors can view patient analyses" ON analyses
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'doctor'
        )
        AND EXISTS (
            SELECT 1 FROM appointments
            WHERE appointments.patient_id = analyses.user_id
            AND appointments.doctor_id = auth.uid()
        )
    );

-- Admins can view all analyses
CREATE POLICY "Admins can view all analyses" ON analyses
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- Trigger to update updated_at
DROP TRIGGER IF EXISTS update_analyses_updated_at ON analyses;
CREATE TRIGGER update_analyses_updated_at
    BEFORE UPDATE ON analyses
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add table and column comments
COMMENT ON TABLE analyses IS 'AI skin analysis results and reports';
COMMENT ON COLUMN analyses.condition_name IS 'Detected skin condition name';
COMMENT ON COLUMN analyses.report_data IS 'Complete AI analysis report in JSON format';
COMMENT ON COLUMN analyses.image_url IS 'URL to the analyzed skin image';

-- =====================================================
-- Migration Complete
-- =====================================================
-- =====================================================
-- Appointments Table Migration
-- =====================================================
-- This migration creates the appointments table for managing
-- doctor-patient consultations (online and offline).

-- Create appointments table
CREATE TABLE IF NOT EXISTS appointments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Participants
    patient_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    doctor_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    
    -- Appointment details
    date DATE NOT NULL,
    time TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('online', 'offline')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled')),
    
    -- Additional information
    notes TEXT,
    patient_notes TEXT,
    doctor_notes TEXT,
    
    -- Video consultation (for online appointments)
    channel_name TEXT,
    agora_token TEXT,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT different_users CHECK (patient_id != doctor_id)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_appointments_patient ON appointments(patient_id);
CREATE INDEX IF NOT EXISTS idx_appointments_doctor ON appointments(doctor_id);
CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(date DESC);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);
CREATE INDEX IF NOT EXISTS idx_appointments_type ON appointments(type);

-- Enable Row Level Security
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Patients can view own appointments" ON appointments;
DROP POLICY IF EXISTS "Doctors can view own appointments" ON appointments;
DROP POLICY IF EXISTS "Patients can create appointments" ON appointments;
DROP POLICY IF EXISTS "Patients can update own appointments" ON appointments;
DROP POLICY IF EXISTS "Doctors can update appointments" ON appointments;
DROP POLICY IF EXISTS "Admins can view all appointments" ON appointments;

-- Patients can view their own appointments
CREATE POLICY "Patients can view own appointments" ON appointments
    FOR SELECT
    USING (auth.uid() = patient_id);

-- Doctors can view appointments where they are the doctor
CREATE POLICY "Doctors can view own appointments" ON appointments
    FOR SELECT
    USING (auth.uid() = doctor_id);

-- Patients can create appointments
CREATE POLICY "Patients can create appointments" ON appointments
    FOR INSERT
    WITH CHECK (
        auth.uid() = patient_id
        AND EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'patient'
        )
    );

-- Patients can update their own pending appointments
CREATE POLICY "Patients can update own appointments" ON appointments
    FOR UPDATE
    USING (
        auth.uid() = patient_id
        AND status = 'pending'
    );

-- Doctors can update appointments where they are the doctor
CREATE POLICY "Doctors can update appointments" ON appointments
    FOR UPDATE
    USING (
        auth.uid() = doctor_id
        AND EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'doctor'
        )
    );

-- Admins can view all appointments
CREATE POLICY "Admins can view all appointments" ON appointments
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- Trigger to update updated_at
DROP TRIGGER IF EXISTS update_appointments_updated_at ON appointments;
CREATE TRIGGER update_appointments_updated_at
    BEFORE UPDATE ON appointments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add table and column comments
COMMENT ON TABLE appointments IS 'Doctor-patient appointments for consultations';
COMMENT ON COLUMN appointments.type IS 'Appointment type: online or offline';
COMMENT ON COLUMN appointments.status IS 'Appointment status: pending, confirmed, completed, or cancelled';
COMMENT ON COLUMN appointments.channel_name IS 'Agora video channel name for online appointments';

-- =====================================================
-- Migration Complete
-- =====================================================
-- =====================================================
-- Doctor Cases Table Migration
-- =====================================================
-- This migration creates the doctor_cases table for managing
-- patient cases and treatment plans by doctors.

-- Create doctor_cases table
CREATE TABLE IF NOT EXISTS doctor_cases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Participants
    doctor_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    patient_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    
    -- Related appointment
    appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
    
    -- Case details
    diagnosis TEXT,
    symptoms TEXT,
    treatment_plan TEXT,
    prescription TEXT,
    notes TEXT,
    
    -- Case status
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'archived')),
    
    -- Follow-up
    follow_up_date DATE,
    follow_up_notes TEXT,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT different_users CHECK (patient_id != doctor_id)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_doctor_cases_doctor ON doctor_cases(doctor_id);
CREATE INDEX IF NOT EXISTS idx_doctor_cases_patient ON doctor_cases(patient_id);
CREATE INDEX IF NOT EXISTS idx_doctor_cases_appointment ON doctor_cases(appointment_id);
CREATE INDEX IF NOT EXISTS idx_doctor_cases_status ON doctor_cases(status);
CREATE INDEX IF NOT EXISTS idx_doctor_cases_created ON doctor_cases(created_at DESC);

-- Enable Row Level Security
ALTER TABLE doctor_cases ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Doctors can view own cases" ON doctor_cases;
DROP POLICY IF EXISTS "Doctors can create cases" ON doctor_cases;
DROP POLICY IF EXISTS "Doctors can update own cases" ON doctor_cases;
DROP POLICY IF EXISTS "Patients can view own cases" ON doctor_cases;
DROP POLICY IF EXISTS "Admins can view all cases" ON doctor_cases;

-- Doctors can view cases where they are the doctor
CREATE POLICY "Doctors can view own cases" ON doctor_cases
    FOR SELECT
    USING (
        auth.uid() = doctor_id
        AND EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'doctor'
        )
    );

-- Doctors can create cases
CREATE POLICY "Doctors can create cases" ON doctor_cases
    FOR INSERT
    WITH CHECK (
        auth.uid() = doctor_id
        AND EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'doctor'
        )
    );

-- Doctors can update their own cases
CREATE POLICY "Doctors can update own cases" ON doctor_cases
    FOR UPDATE
    USING (
        auth.uid() = doctor_id
        AND EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'doctor'
        )
    );

-- Patients can view cases where they are the patient
CREATE POLICY "Patients can view own cases" ON doctor_cases
    FOR SELECT
    USING (auth.uid() = patient_id);

-- Admins can view all cases
CREATE POLICY "Admins can view all cases" ON doctor_cases
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- Trigger to update updated_at
DROP TRIGGER IF EXISTS update_doctor_cases_updated_at ON doctor_cases;
CREATE TRIGGER update_doctor_cases_updated_at
    BEFORE UPDATE ON doctor_cases
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add table and column comments
COMMENT ON TABLE doctor_cases IS 'Patient cases managed by doctors';
COMMENT ON COLUMN doctor_cases.diagnosis IS 'Medical diagnosis for the case';
COMMENT ON COLUMN doctor_cases.treatment_plan IS 'Prescribed treatment plan';
COMMENT ON COLUMN doctor_cases.status IS 'Case status: active, completed, or archived';

-- =====================================================
-- Migration Complete
-- =====================================================
-- =====================================================
-- Contact Requests Table Migration
-- =====================================================
-- This migration creates the contact_requests table for storing
-- user contact requests (enquiries, role changes, technical support, feedback)
-- with admin approval workflow and document upload functionality.
--
-- CONSOLIDATED MIGRATION:
-- This file combines functionality from:
-- - contact_requests_table.sql (base table)
-- - 07_update_contact_requests_status.sql (status enum)
-- - 08_add_user_update_policy.sql (user update policy)
-- =====================================================

-- Create contact_requests table
CREATE TABLE IF NOT EXISTS contact_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- User information
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    user_name TEXT NOT NULL,
    user_email TEXT NOT NULL,
    
    -- Request details
    request_type TEXT NOT NULL CHECK (request_type IN ('enquiry', 'role-change', 'technical-support', 'feedback')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (
        status IN ('pending', 'approved', 'rejected', 'approved_for_docs', 'verification_pending')
    ),
    
    -- Request data (JSON)
    data JSONB NOT NULL,
    
    -- Admin actions
    admin_notes TEXT,
    reviewed_by UUID REFERENCES profiles(id),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_contact_requests_user ON contact_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_contact_requests_type ON contact_requests(request_type);
CREATE INDEX IF NOT EXISTS idx_contact_requests_status ON contact_requests(status);
CREATE INDEX IF NOT EXISTS idx_contact_requests_created ON contact_requests(created_at DESC);

-- Enable Row Level Security
ALTER TABLE contact_requests ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for re-running migration)
DROP POLICY IF EXISTS "Users can view own requests" ON contact_requests;
DROP POLICY IF EXISTS "Users can create requests" ON contact_requests;
DROP POLICY IF EXISTS "Users can update own requests" ON contact_requests;
DROP POLICY IF EXISTS "Admins can view all requests" ON contact_requests;
DROP POLICY IF EXISTS "Admins can update requests" ON contact_requests;

-- Users can view their own requests
CREATE POLICY "Users can view own requests" ON contact_requests
    FOR SELECT
    USING (auth.uid() = user_id);

-- Users can create requests
CREATE POLICY "Users can create requests" ON contact_requests
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Users can update their own requests (for document uploads)
-- This is specifically needed for document uploads when status is approved_for_docs
CREATE POLICY "Users can update own requests" ON contact_requests
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (
        auth.uid() = user_id 
        AND status IN ('approved_for_docs', 'verification_pending')
    );

-- Admins can view all requests
CREATE POLICY "Admins can view all requests" ON contact_requests
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- Admins can update requests (approve/reject)
CREATE POLICY "Admins can update requests" ON contact_requests
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- Trigger to update updated_at
DROP TRIGGER IF EXISTS update_contact_requests_updated_at ON contact_requests;
CREATE TRIGGER update_contact_requests_updated_at
    BEFORE UPDATE ON contact_requests
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add table and column comments for documentation
COMMENT ON TABLE contact_requests IS 'Stores user contact requests for admin review and approval';
COMMENT ON COLUMN contact_requests.user_id IS 'Reference to the user who submitted the request';
COMMENT ON COLUMN contact_requests.request_type IS 'Type of request: enquiry, role-change, technical-support, or feedback';
COMMENT ON COLUMN contact_requests.status IS 'Request status: pending, approved, rejected, approved_for_docs (admin allowed upload), verification_pending (docs uploaded, awaiting final review)';
COMMENT ON COLUMN contact_requests.data IS 'JSON object containing request-specific data (form fields)';
COMMENT ON COLUMN contact_requests.admin_notes IS 'Optional notes added by admin when reviewing';
COMMENT ON COLUMN contact_requests.reviewed_by IS 'Admin user who reviewed the request';
COMMENT ON COLUMN contact_requests.reviewed_at IS 'Timestamp when request was reviewed';

-- =====================================================
-- Migration Complete
-- =====================================================
-- This migration creates the complete contact_requests system with:
-- 1. Table structure for all request types
-- 2. Expanded status enum for document upload workflow
-- 3. RLS policies for users and admins
-- 4. User update policy for document uploads
-- 5. Indexes for performance
-- 6. Automatic updated_at trigger
-- =====================================================
-- Create connection_requests table
create table if not exists connection_requests (
  id uuid default gen_random_uuid() primary key,
  patient_id uuid references profiles(id) on delete cascade not null,
  doctor_id uuid references profiles(id) on delete cascade not null,
  status text check (status in ('pending', 'accepted', 'rejected')) default 'pending',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,

  -- Ensure unique pair of patient and doctor
  unique(patient_id, doctor_id)
);

-- Enable Row Level Security
alter table connection_requests enable row level security;

-- Policies
-- Patients can view their own requests
create policy "Patients can view their own requests"
  on connection_requests for select
  using (auth.uid() = patient_id);

-- Doctors can view requests sent to them
create policy "Doctors can view requests sent to them"
  on connection_requests for select
  using (auth.uid() = doctor_id);

-- Patients can insert requests
create policy "Patients can cancel/create requests"
  on connection_requests for insert
  with check (auth.uid() = patient_id);

-- Doctors can update status (accept/reject)
create policy "Doctors can update status"
  on connection_requests for update
  using (auth.uid() = doctor_id);
-- Create a new storage bucket for verification documents
insert into storage.buckets (id, name, public)
values ('verification-docs', 'verification-docs', true)
on conflict (id) do nothing;

-- Set up security policies for the bucket
create policy "Authenticated users can upload verification docs"
  on storage.objects for insert
  with check ( bucket_id = 'verification-docs' and auth.role() = 'authenticated' );

create policy "Users can view verification docs"
  on storage.objects for select
  using ( bucket_id = 'verification-docs' );
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
-- =====================================================
-- Fix Admin RLS Policies - Infinite Recursion Fix
-- =====================================================
-- This migration fixes the infinite recursion error in admin RLS policies
-- by using a SECURITY DEFINER function that bypasses RLS.

-- =====================================================
-- STEP 1: Create Helper Function to Check Admin Role
-- =====================================================
-- This function bypasses RLS to check if a user is an admin
-- SECURITY DEFINER means it runs with the permissions of the function owner
CREATE OR REPLACE FUNCTION public.is_admin(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = user_id AND role = 'admin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.is_admin IS 
    'Checks if a user is an admin. Uses SECURITY DEFINER to bypass RLS and avoid infinite recursion.';

-- =====================================================
-- STEP 2: Fix Profiles Table Policies
-- =====================================================

-- Drop existing admin policies
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON profiles;

-- Recreate admin view policy using the helper function
CREATE POLICY "Admins can view all profiles" ON profiles
    FOR SELECT
    USING (
        public.is_admin(auth.uid())
        OR auth.uid() = id
    );

-- Fix admin update policy using the helper function
CREATE POLICY "Admins can update all profiles" ON profiles
    FOR UPDATE
    USING (
        public.is_admin(auth.uid())
    )
    WITH CHECK (
        public.is_admin(auth.uid())
    );

COMMENT ON POLICY "Admins can view all profiles" ON profiles IS
    'Allows admins to view all user profiles, and users to view their own';

COMMENT ON POLICY "Admins can update all profiles" ON profiles IS
    'Allows admins to update any user profile (needed for role changes)';

-- =====================================================
-- STEP 3: Fix Contact Requests Table Policies
-- =====================================================

-- Drop existing admin policies for contact_requests
DROP POLICY IF EXISTS "Admins can view all requests" ON contact_requests;
DROP POLICY IF EXISTS "Admins can update requests" ON contact_requests;

-- Recreate admin view policy for contact_requests using helper function
CREATE POLICY "Admins can view all requests" ON contact_requests
    FOR SELECT
    USING (
        public.is_admin(auth.uid())
    );

-- Fix admin update policy for contact_requests using helper function
CREATE POLICY "Admins can update requests" ON contact_requests
    FOR UPDATE
    USING (
        public.is_admin(auth.uid())
    )
    WITH CHECK (
        public.is_admin(auth.uid())
    );

COMMENT ON POLICY "Admins can view all requests" ON contact_requests IS
    'Allows admins to view all contact requests';

COMMENT ON POLICY "Admins can update requests" ON contact_requests IS
    'Allows admins to update any contact request (approve/reject)';

-- =====================================================
-- Verification
-- =====================================================
-- Run these queries to verify the policies are correct:

-- Check if is_admin function works:
-- SELECT public.is_admin(auth.uid());

-- Check profiles policies:
-- SELECT schemaname, tablename, policyname, permissive, roles, cmd
-- FROM pg_policies
-- WHERE tablename = 'profiles' AND policyname LIKE '%Admin%';

-- Check contact_requests policies:
-- SELECT schemaname, tablename, policyname, permissive, roles, cmd
-- FROM pg_policies
-- WHERE tablename = 'contact_requests' AND policyname LIKE '%Admin%';

-- Test admin can view profiles (should work without recursion):
-- SELECT COUNT(*) FROM profiles;

-- Test admin can view contact_requests (should work without recursion):
-- SELECT COUNT(*) FROM contact_requests;

-- =====================================================
-- Migration Complete
-- =====================================================
-- The is_admin() function uses SECURITY DEFINER to bypass RLS,
-- preventing infinite recursion when checking admin permissions.
-- =====================================================
-- Enhanced Doctor Profile Fields Migration
-- Adds education, certificates, testimonials, and other professional information

-- Add new columns to profiles table
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS education JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS certificates JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS testimonials JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS years_of_experience INTEGER,
ADD COLUMN IF NOT EXISTS languages TEXT[],
ADD COLUMN IF NOT EXISTS consultation_fee TEXT;

-- Add index for better query performance on verified doctors
CREATE INDEX IF NOT EXISTS idx_profiles_verified_doctors 
ON profiles(role, verified) 
WHERE role = 'doctor' AND verified = true;

-- Add comment for documentation
COMMENT ON COLUMN profiles.education IS 'Array of education entries with degree, institution, year, and field';
COMMENT ON COLUMN profiles.certificates IS 'Array of certificate entries with name, issuer, year, and optional URL';
COMMENT ON COLUMN profiles.testimonials IS 'Array of testimonial entries with name, role, text, and date';
COMMENT ON COLUMN profiles.years_of_experience IS 'Total years of medical practice experience';
COMMENT ON COLUMN profiles.languages IS 'Array of languages spoken by the doctor';
COMMENT ON COLUMN profiles.consultation_fee IS 'Consultation fee as text (e.g., "$100" or "Free for first visit")';
-- Migration: Add documents_public field to profiles table
-- This allows doctors to control whether their verification documents are publicly visible

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS documents_public BOOLEAN DEFAULT false;

COMMENT ON COLUMN profiles.documents_public IS 'Controls whether verification documents are visible to patients viewing the doctor profile';
-- Migration: Add trigger to delete auth.users when profile is deleted
-- This ensures complete account deletion when user deletes their account

-- Create function to delete auth user
CREATE OR REPLACE FUNCTION delete_auth_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
    -- Delete the user from auth.users
    DELETE FROM auth.users WHERE id = OLD.id;
    RETURN OLD;
END;
$$;

-- Create trigger that fires AFTER profile deletion
DROP TRIGGER IF EXISTS on_profile_delete_trigger ON profiles;
CREATE TRIGGER on_profile_delete_trigger
    AFTER DELETE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION delete_auth_user();

COMMENT ON FUNCTION delete_auth_user() IS 'Automatically deletes user from auth.users when their profile is deleted';
COMMENT ON TRIGGER on_profile_delete_trigger ON profiles IS 'Ensures complete account deletion by removing auth.users entry when profile is deleted';
-- Migration to ensure signature_url and related columns exist in profiles table
-- Numbered 13 to follow the existing sequence

-- Add signature_url column if it doesn't exist
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS signature_url TEXT;

-- Add signature_public_id column if it doesn't exist
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS signature_public_id TEXT;

-- Add comment for documentation
COMMENT ON COLUMN profiles.signature_url IS 'URL of the doctor''s digital signature image';
COMMENT ON COLUMN profiles.signature_public_id IS 'Cloudinary public ID for the signature image';
-- =====================================================
-- Schema Fixes for Application Compatibility
-- =====================================================
-- This migration adds missing columns and constraints identified
-- during codebase analysis to ensure all application queries work correctly.
-- =====================================================

-- 1. Update Appointments Table
-- Add columns used in DoctorAppointmentsPage and Patient AppointmentsPage
ALTER TABLE appointments 
ADD COLUMN IF NOT EXISTS appointment_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS prescription JSONB,
ADD COLUMN IF NOT EXISTS doctor_name TEXT,
ADD COLUMN IF NOT EXISTS patient_name TEXT,
ADD COLUMN IF NOT EXISTS doctor_location TEXT,
ADD COLUMN IF NOT EXISTS doctor_phone TEXT,
ADD COLUMN IF NOT EXISTS doctor_signature TEXT,
ADD COLUMN IF NOT EXISTS appointment_mode TEXT;

COMMENT ON COLUMN appointments.appointment_date IS 'Confirmed date and time of the appointment';
COMMENT ON COLUMN appointments.prescription IS 'E-prescription data (medication, dosage, instructions)';
COMMENT ON COLUMN appointments.doctor_name IS 'Cached doctor name';
COMMENT ON COLUMN appointments.patient_name IS 'Cached patient name';
COMMENT ON COLUMN appointments.doctor_location IS 'Doctor clinic location snapshot';
COMMENT ON COLUMN appointments.doctor_phone IS 'Doctor contact snapshot';
COMMENT ON COLUMN appointments.doctor_signature IS 'Doctor signature URL snapshot';
COMMENT ON COLUMN appointments.appointment_mode IS 'Online or Offline mode (supplements type column)';

-- 2. Update Doctor Cases Table
-- Add columns used in DoctorCasesPage
ALTER TABLE doctor_cases 
ADD COLUMN IF NOT EXISTS patient_name TEXT,
ADD COLUMN IF NOT EXISTS last_appointment_date TIMESTAMP WITH TIME ZONE;

COMMENT ON COLUMN doctor_cases.patient_name IS 'Cached patient name for easier display';
COMMENT ON COLUMN doctor_cases.last_appointment_date IS 'Timestamp of the most recent appointment';

-- Add Unique Constraint for Upsert
-- Required for: .upsert({ ... }, { onConflict: 'doctor_id,patient_id' })
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'doctor_cases_doctor_patient_unique'
    ) THEN
        ALTER TABLE doctor_cases
        ADD CONSTRAINT doctor_cases_doctor_patient_unique UNIQUE (doctor_id, patient_id);
    END IF;
END $$;

COMMENT ON CONSTRAINT doctor_cases_doctor_patient_unique ON doctor_cases IS 'Ensures one case record per doctor-patient pair';

-- 3. Update Connection Requests Table
-- Add trigger for updated_at
DROP TRIGGER IF EXISTS update_connection_requests_updated_at ON connection_requests;
CREATE TRIGGER update_connection_requests_updated_at
    BEFORE UPDATE ON connection_requests
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- Migration Complete
-- =====================================================
-- Create doctor_reviews table
-- Linked to profiles (doctor and patient)
-- Includes rating (1-5), testimonial (kudos), and feedback


-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TABLE IF NOT EXISTS doctor_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    doctor_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    patient_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    kudos TEXT, -- Public testimonial
    feedback TEXT, -- Private feedback or additional comments
    is_public BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for querying reviews
CREATE INDEX IF NOT EXISTS idx_doctor_reviews_doctor_id ON doctor_reviews(doctor_id);
CREATE INDEX IF NOT EXISTS idx_doctor_reviews_rating ON doctor_reviews(rating);

-- RLS Policies
ALTER TABLE doctor_reviews ENABLE ROW LEVEL SECURITY;

-- Everyone can read public reviews
CREATE POLICY "Public reviews are viewable by everyone" 
    ON doctor_reviews FOR SELECT 
    USING (is_public = true);

-- Patients can create reviews
CREATE POLICY "Patients can create reviews" 
    ON doctor_reviews FOR INSERT 
    WITH CHECK (auth.uid() = patient_id);

-- Patients can update their own reviews
CREATE POLICY "Patients can update own reviews" 
    ON doctor_reviews FOR UPDATE 
    USING (auth.uid() = patient_id);

-- Doctors can view all reviews for them (including non-public if we decide to use that)
CREATE POLICY "Doctors can view reviews about themselves" 
    ON doctor_reviews FOR SELECT 
    USING (auth.uid() = doctor_id);
    
-- Add trigger for updated_at
CREATE TRIGGER update_doctor_reviews_updated_at
    BEFORE UPDATE ON doctor_reviews
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
-- =====================================================
-- Fix RLS Policies for Doctor-Patient Access
-- =====================================================
-- This migration adds missing RLS policies to allow doctors to view
-- profiles of patients they are treating or have appointments with.
-- =====================================================

-- 1. Allow Doctors to view Patient Profiles
-- Doctors need to see profile details (photo, bio, etc.) of their patients.
-- Access is granted if a doctor has a case or an appointment with the patient.

CREATE POLICY "Doctors can view assigned patients" ON profiles
    FOR SELECT
    USING (
        role = 'patient' 
        AND (
            EXISTS (
                SELECT 1 FROM doctor_cases
                WHERE doctor_cases.patient_id = profiles.id
                AND doctor_cases.doctor_id = auth.uid()
            )
            OR
            EXISTS (
                SELECT 1 FROM appointments
                WHERE appointments.patient_id = profiles.id
                AND appointments.doctor_id = auth.uid()
            )
        )
    );

COMMENT ON POLICY "Doctors can view assigned patients" ON profiles IS 'Allows doctors to view profiles of patients they have cases or appointments with';

-- =====================================================
-- Migration Complete
-- =====================================================
-- Fix missing doctor profile columns that were causing PGRST204 errors
-- This re-applies the changes from 10_doctor_profile_fields.sql

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS education JSONB DEFAULT '[]'::jsonb;

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS certificates JSONB DEFAULT '[]'::jsonb;

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS testimonials JSONB DEFAULT '[]'::jsonb;

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS years_of_experience INTEGER;

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS languages TEXT[];

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS consultation_fee TEXT;

-- Re-apply comments to ensure schema metadata is correct
COMMENT ON COLUMN profiles.education IS 'Array of education entries with degree, institution, year, and field';
COMMENT ON COLUMN profiles.certificates IS 'Array of certificate entries with name, issuer, year, and optional URL';
COMMENT ON COLUMN profiles.testimonials IS 'Array of testimonial entries with name, role, text, and date';
COMMENT ON COLUMN profiles.years_of_experience IS 'Total years of medical practice experience';
COMMENT ON COLUMN profiles.languages IS 'Array of languages spoken by the doctor';
COMMENT ON COLUMN profiles.consultation_fee IS 'Consultation fee as text (e.g., "$100" or "Free for first visit")';

-- Ensure the index exists
CREATE INDEX IF NOT EXISTS idx_profiles_verified_doctors 
ON profiles(role, verified) 
WHERE role = 'doctor' AND verified = true;

-- Grant permissions if needed (usually handled by default, but good to be safe)
GRANT ALL ON profiles TO authenticated;
GRANT ALL ON profiles TO service_role;
-- Refine connection_requests RLS policies
-- Drops existing policies and recreates them with better naming and coverage

-- Drop existing policies
DROP POLICY IF EXISTS "Patients can view their own requests" ON connection_requests;
DROP POLICY IF EXISTS "Doctors can view requests sent to them" ON connection_requests;
DROP POLICY IF EXISTS "Patients can cancel/create requests" ON connection_requests;
DROP POLICY IF EXISTS "Doctors can update status" ON connection_requests;

-- 1. Patients can view their own requests
CREATE POLICY "connection_requests_patient_select"
  ON connection_requests FOR SELECT
  USING (auth.uid() = patient_id);

-- 2. Doctors can view requests sent to them
CREATE POLICY "connection_requests_doctor_select"
  ON connection_requests FOR SELECT
  USING (auth.uid() = doctor_id);

-- 3. Patients can insert connection requests
-- WITH CHECK ensures the patient_id matches the authenticated user
CREATE POLICY "connection_requests_patient_insert"
  ON connection_requests FOR INSERT
  WITH CHECK (auth.uid() = patient_id);

-- 4. Patients can delete (cancel) their own pending requests
CREATE POLICY "connection_requests_patient_delete"
  ON connection_requests FOR DELETE
  USING (auth.uid() = patient_id AND status = 'pending');

-- 5. Doctors can update status of requests sent to them
-- Typically they only change status from 'pending' to 'accepted' or 'rejected'
CREATE POLICY "connection_requests_doctor_update"
  ON connection_requests FOR UPDATE
  USING (auth.uid() = doctor_id);

-- Add performance indexes if missing
CREATE INDEX IF NOT EXISTS idx_connection_requests_patient_id ON connection_requests(patient_id);
CREATE INDEX IF NOT EXISTS idx_connection_requests_doctor_id ON connection_requests(doctor_id);
CREATE INDEX IF NOT EXISTS idx_connection_requests_status ON connection_requests(status);
-- Add missing columns to appointments table to support the appointment request flow
ALTER TABLE appointments 
ADD COLUMN IF NOT EXISTS preferred_date DATE,
ADD COLUMN IF NOT EXISTS preferred_time TEXT,
ADD COLUMN IF NOT EXISTS reason_for_visit TEXT,
ADD COLUMN IF NOT EXISTS symptoms_duration TEXT,
ADD COLUMN IF NOT EXISTS symptoms_severity TEXT,
ADD COLUMN IF NOT EXISTS past_treatments TEXT,
ADD COLUMN IF NOT EXISTS current_medications TEXT,
ADD COLUMN IF NOT EXISTS allergies TEXT,
ADD COLUMN IF NOT EXISTS is_emergency BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS consent_data BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS agree_terms BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS attached_report_id UUID REFERENCES analyses(id),
ADD COLUMN IF NOT EXISTS attached_report_summary JSONB,
ADD COLUMN IF NOT EXISTS uploaded_image_urls TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS uploaded_report_urls TEXT[] DEFAULT '{}';

-- Update the status check constraint to include 'Declined' and 'Confirmed' (with proper casing)
ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_status_check;

ALTER TABLE appointments 
ADD CONSTRAINT appointments_status_check 
CHECK (status IN ('Pending', 'Confirmed', 'Declined', 'Completed', 'Cancelled', 'pending', 'confirmed', 'completed', 'cancelled'));

-- Safely drop NOT NULL from date/time/type columns only if they exist
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='appointments' AND column_name='date') THEN
        ALTER TABLE appointments ALTER COLUMN date DROP NOT NULL;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='appointments' AND column_name='time') THEN
        ALTER TABLE appointments ALTER COLUMN time DROP NOT NULL;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='appointments' AND column_name='type') THEN
        ALTER TABLE appointments ALTER COLUMN type DROP NOT NULL;
    END IF;
END $$;
