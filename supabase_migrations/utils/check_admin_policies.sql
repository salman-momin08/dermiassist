-- =====================================================
-- Check Admin RLS Policies Status
-- =====================================================
-- Run this query to check if the RLS policies are correctly configured

-- 1. Check if you are logged in as an admin
SELECT 
    id,
    email,
    role,
    display_name
FROM profiles
WHERE id = auth.uid();

-- Expected: Should show your profile with role = 'admin'

-- 2. Check profiles table policies
SELECT 
    schemaname,
    tablename,
    policyname,
    cmd,
    qual IS NOT NULL as has_using,
    with_check IS NOT NULL as has_with_check
FROM pg_policies
WHERE tablename = 'profiles' 
AND policyname LIKE '%Admin%'
ORDER BY policyname;

-- Expected: Both policies should have has_using = true
-- The UPDATE policy should also have has_with_check = true

-- 3. Check contact_requests table policies
SELECT 
    schemaname,
    tablename,
    policyname,
    cmd,
    qual IS NOT NULL as has_using,
    with_check IS NOT NULL as has_with_check
FROM pg_policies
WHERE tablename = 'contact_requests' 
AND policyname LIKE '%Admin%'
ORDER BY policyname;

-- Expected: Both policies should have has_using = true
-- The UPDATE policy should also have has_with_check = true

-- 4. Test if admin can view contact_requests
SELECT COUNT(*) as total_requests
FROM contact_requests;

-- If this returns a count, RLS is working
-- If this returns an error, RLS policies are blocking you

-- 5. Check if there are any contact_requests in the database
SELECT 
    id,
    user_email,
    request_type,
    status,
    created_at
FROM contact_requests
ORDER BY created_at DESC
LIMIT 5;

-- =====================================================
-- Troubleshooting
-- =====================================================
-- If queries 4 or 5 fail, it means:
-- 1. You haven't run migration 10 yet, OR
-- 2. Your current user is not an admin, OR
-- 3. The RLS policies are still incorrect

-- To fix:
-- 1. Run migration 10_fix_admin_rls_policy.sql
-- 2. Verify your user has role = 'admin' in profiles table
-- 3. Refresh your browser/clear cache
-- =====================================================
