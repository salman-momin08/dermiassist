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
