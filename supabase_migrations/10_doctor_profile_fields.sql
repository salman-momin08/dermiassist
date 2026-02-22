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
