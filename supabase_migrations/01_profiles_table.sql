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
