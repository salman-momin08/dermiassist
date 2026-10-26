-- =====================================================
-- 03 · connection_requests  (patient -> doctor connection)
-- =====================================================
-- Reconciles: 06_connection_requests_table, 14_schema_fixes (updated_at trigger),
--             18_fix_connection_requests_rls, 32_rls_policy_fixes.
-- Depends on: 00, 01 (profiles). Created before doctor_cases (05), whose
-- create-policy checks for an accepted connection_request.

CREATE TABLE IF NOT EXISTS connection_requests (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    patient_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    doctor_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,

    UNIQUE (patient_id, doctor_id)
);

CREATE INDEX IF NOT EXISTS idx_connection_requests_patient_id ON connection_requests(patient_id);
CREATE INDEX IF NOT EXISTS idx_connection_requests_doctor_id ON connection_requests(doctor_id);
CREATE INDEX IF NOT EXISTS idx_connection_requests_status ON connection_requests(status);

-- ── Security trigger: block non-admins reassigning patient_id/doctor_id ──────
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

-- ── Row Level Security ──────────────────────────────────────────────────────
ALTER TABLE connection_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "connection_requests_patient_select" ON connection_requests
    FOR SELECT USING (auth.uid() = patient_id);

CREATE POLICY "connection_requests_doctor_select" ON connection_requests
    FOR SELECT USING (auth.uid() = doctor_id);

CREATE POLICY "connection_requests_patient_insert" ON connection_requests
    FOR INSERT WITH CHECK (auth.uid() = patient_id);

CREATE POLICY "connection_requests_patient_delete" ON connection_requests
    FOR DELETE USING (auth.uid() = patient_id AND status = 'pending');

CREATE POLICY "connection_requests_doctor_update" ON connection_requests
    FOR UPDATE USING (auth.uid() = doctor_id);

-- ── Triggers ────────────────────────────────────────────────────────────────
CREATE TRIGGER update_connection_requests_updated_at
    BEFORE UPDATE ON connection_requests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_prevent_connection_request_reassignment
    BEFORE UPDATE ON connection_requests
    FOR EACH ROW EXECUTE FUNCTION public.prevent_connection_request_reassignment();
