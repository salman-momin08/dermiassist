-- Migration: Add documents_public field to profiles table
-- This allows doctors to control whether their verification documents are publicly visible

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS documents_public BOOLEAN DEFAULT false;

COMMENT ON COLUMN profiles.documents_public IS 'Controls whether verification documents are visible to patients viewing the doctor profile';
