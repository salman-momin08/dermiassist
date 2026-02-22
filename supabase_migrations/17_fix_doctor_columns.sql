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
