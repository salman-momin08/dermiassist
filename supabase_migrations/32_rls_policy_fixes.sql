-- =====================================================
-- RLS Policy Security Fixes
-- =====================================================
-- Fixes several RLS gaps found in a security audit:
--   1. profiles: self-service privilege escalation to admin/verified-doctor
--      (UPDATE policy had USING but no WITH CHECK, and WITH CHECK alone
--       can't safely compare OLD vs NEW column values, so a trigger is used)
--   2. appointments: UPDATE policy allowed silently reassigning
--      patient_id/doctor_id, letting a doctor "hijack" another patient's
--      analyses via the "Doctors can view patient analyses" policy
--   3. connection_requests: same reassignment gap on the doctor update policy
--   4. doctor_cases: INSERT had no check that the doctor is actually
--      connected to (or has an appointment with) the named patient
--   5. doctor_reviews: the public SELECT policy exposed the "private"
--      feedback column and patient_id to any anon/authenticated caller
--      that queries the table directly (bypassing the app's careful
--      column-limited select)
-- =====================================================

-- =====================================================
-- 1. profiles — block self-service role/verified changes
-- =====================================================
-- USING (auth.uid() = id) with no WITH CHECK lets any user set role/verified
-- to anything on their own row, since id never changes across the update.
-- A trigger is used instead of WITH CHECK because WITH CHECK subqueries
-- against the same table have OLD/NEW visibility subtleties in Postgres;
-- a BEFORE UPDATE trigger comparing OLD/NEW directly is unambiguous.
CREATE OR REPLACE FUNCTION public.prevent_self_role_escalation()
RETURNS TRIGGER AS $$
BEGIN
    IF NOT public.is_admin(auth.uid()) THEN
        IF NEW.role IS DISTINCT FROM OLD.role OR NEW.verified IS DISTINCT FROM OLD.verified THEN
            RAISE EXCEPTION 'Only an admin can change role or verified status';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.prevent_self_role_escalation IS
    'Blocks non-admins from changing profiles.role or profiles.verified on any UPDATE, including their own row.';

DROP TRIGGER IF EXISTS trg_prevent_self_role_escalation ON profiles;
CREATE TRIGGER trg_prevent_self_role_escalation
    BEFORE UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_self_role_escalation();

-- =====================================================
-- 2. appointments — block reassigning patient_id/doctor_id
-- =====================================================
CREATE OR REPLACE FUNCTION public.prevent_appointment_reassignment()
RETURNS TRIGGER AS $$
BEGIN
    IF NOT public.is_admin(auth.uid()) THEN
        IF NEW.patient_id IS DISTINCT FROM OLD.patient_id OR NEW.doctor_id IS DISTINCT FROM OLD.doctor_id THEN
            RAISE EXCEPTION 'Cannot reassign an appointment to a different patient or doctor';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.prevent_appointment_reassignment IS
    'Blocks non-admins from changing appointments.patient_id or appointments.doctor_id on UPDATE.';

DROP TRIGGER IF EXISTS trg_prevent_appointment_reassignment ON appointments;
CREATE TRIGGER trg_prevent_appointment_reassignment
    BEFORE UPDATE ON appointments
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_appointment_reassignment();

-- =====================================================
-- 3. connection_requests — same reassignment gap
-- =====================================================
-- Targets the current policy name (connection_requests_doctor_update, from
-- 18_fix_connection_requests_rls.sql) which still has USING but no WITH CHECK.
CREATE OR REPLACE FUNCTION public.prevent_connection_request_reassignment()
RETURNS TRIGGER AS $$
BEGIN
    IF NOT public.is_admin(auth.uid()) THEN
        IF NEW.patient_id IS DISTINCT FROM OLD.patient_id OR NEW.doctor_id IS DISTINCT FROM OLD.doctor_id THEN
            RAISE EXCEPTION 'Cannot reassign a connection request to a different patient or doctor';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.prevent_connection_request_reassignment IS
    'Blocks non-admins from changing connection_requests.patient_id or .doctor_id on UPDATE.';

DROP TRIGGER IF EXISTS trg_prevent_connection_request_reassignment ON connection_requests;
CREATE TRIGGER trg_prevent_connection_request_reassignment
    BEFORE UPDATE ON connection_requests
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_connection_request_reassignment();

-- =====================================================
-- 4. doctor_cases — require an actual doctor-patient relationship
-- =====================================================
DROP POLICY IF EXISTS "Doctors can create cases" ON doctor_cases;
CREATE POLICY "Doctors can create cases" ON doctor_cases
    FOR INSERT
    WITH CHECK (
        auth.uid() = doctor_id
        AND EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'doctor'
            AND profiles.verified = true
        )
        AND (
            EXISTS (
                SELECT 1 FROM appointments
                WHERE appointments.doctor_id = doctor_cases.doctor_id
                AND appointments.patient_id = doctor_cases.patient_id
            )
            OR EXISTS (
                SELECT 1 FROM connection_requests
                WHERE connection_requests.doctor_id = doctor_cases.doctor_id
                AND connection_requests.patient_id = doctor_cases.patient_id
                AND connection_requests.status = 'accepted'
            )
        )
    );

COMMENT ON POLICY "Doctors can create cases" ON doctor_cases IS
    'A verified doctor may only open a case for a patient they have an appointment with or an accepted connection request from.';

-- =====================================================
-- 5. doctor_reviews — stop leaking private feedback + patient_id
-- =====================================================
-- The old "Public reviews are viewable by everyone" policy exposed every
-- column (including the "private" feedback text and patient_id) to any
-- anon/authenticated caller querying the table directly. RLS can't filter
-- columns, only rows, so the fix is: remove blanket table access and
-- publish a narrow view with just the safe columns for public listings.
DROP POLICY IF EXISTS "Public reviews are viewable by everyone" ON doctor_reviews;

-- Patients can still see their own submitted review (previously only
-- reachable via the now-removed public policy).
DROP POLICY IF EXISTS "Patients can view own reviews" ON doctor_reviews;
CREATE POLICY "Patients can view own reviews" ON doctor_reviews
    FOR SELECT
    USING (auth.uid() = patient_id);

-- Safe public view: no feedback text, no patient_id.
CREATE OR REPLACE VIEW public_doctor_reviews AS
SELECT id, doctor_id, rating, kudos, created_at
FROM doctor_reviews
WHERE is_public = true;

GRANT SELECT ON public_doctor_reviews TO anon, authenticated;

COMMENT ON VIEW public_doctor_reviews IS
    'Public-safe projection of doctor_reviews for doctor-profile listings: excludes feedback (private) and patient_id.';

-- =====================================================
-- Migration Complete
-- =====================================================
