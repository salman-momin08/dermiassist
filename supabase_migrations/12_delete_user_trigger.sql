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
