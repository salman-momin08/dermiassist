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
