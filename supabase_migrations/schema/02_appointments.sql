-- =====================================================
-- 02 · appointments
-- =====================================================
-- Reconciles: 03_appointments_table, 14_schema_fixes, 19_fix_appointments_columns,
--             32_rls_policy_fixes.
-- Depends on: 00, 01 (profiles). The composite FK + partition-key trigger linking
-- attached_report_id -> analyses(id, created_at) are added in 04_analyses.sql
-- (after the partitioned analyses table exists); the audit trigger in 09.

CREATE TABLE IF NOT EXISTS appointments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Participants
    patient_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    doctor_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

    -- Core appointment details (date/time/type nullable since the request flow
    -- captures preferred_* before a slot is confirmed).
    date DATE,
    time TEXT,
    type TEXT CHECK (type IN ('online', 'offline')),
    status TEXT NOT NULL DEFAULT 'pending',
    notes TEXT,
    patient_notes TEXT,
    doctor_notes TEXT,

    -- Video consultation (online appointments)
    channel_name TEXT,
    agora_token TEXT,

    -- Confirmed scheduling + cached snapshots
    appointment_date TIMESTAMP WITH TIME ZONE,
    prescription JSONB,
    doctor_name TEXT,
    patient_name TEXT,
    doctor_location TEXT,
    doctor_phone TEXT,
    doctor_signature TEXT,
    appointment_mode TEXT,

    -- Appointment-request intake fields
    preferred_date DATE,
    preferred_time TEXT,
    reason_for_visit TEXT,
    symptoms_duration TEXT,
    symptoms_severity TEXT,
    past_treatments TEXT,
    current_medications TEXT,
    allergies TEXT,
    is_emergency BOOLEAN DEFAULT FALSE,
    consent_data BOOLEAN DEFAULT FALSE,
    agree_terms BOOLEAN DEFAULT FALSE,

    -- Attached AI report (composite FK to partitioned analyses added in 04)
    attached_report_id UUID,
    attached_report_created_at TIMESTAMP WITH TIME ZONE,
    attached_report_summary JSONB,
    uploaded_image_urls TEXT[] DEFAULT '{}',
    uploaded_report_urls TEXT[] DEFAULT '{}',

    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    CONSTRAINT different_users CHECK (patient_id != doctor_id),
    CONSTRAINT appointments_status_check CHECK (
        status IN ('Pending', 'Confirmed', 'Declined', 'Completed', 'Cancelled',
                   'pending', 'confirmed', 'completed', 'cancelled')
    )
);

CREATE INDEX IF NOT EXISTS idx_appointments_patient ON appointments(patient_id);
CREATE INDEX IF NOT EXISTS idx_appointments_doctor ON appointments(doctor_id);
CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(date DESC);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);
CREATE INDEX IF NOT EXISTS idx_appointments_type ON appointments(type);

-- ── Security trigger: block non-admins reassigning patient_id/doctor_id ──────
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

-- ── Row Level Security ──────────────────────────────────────────────────────
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Patients can view own appointments" ON appointments
    FOR SELECT USING (auth.uid() = patient_id);

CREATE POLICY "Doctors can view own appointments" ON appointments
    FOR SELECT USING (auth.uid() = doctor_id);

CREATE POLICY "Patients can create appointments" ON appointments
    FOR INSERT WITH CHECK (
        auth.uid() = patient_id
        AND EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'patient')
    );

CREATE POLICY "Patients can update own appointments" ON appointments
    FOR UPDATE USING (auth.uid() = patient_id AND status = 'pending');

CREATE POLICY "Doctors can update appointments" ON appointments
    FOR UPDATE USING (
        auth.uid() = doctor_id
        AND EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'doctor')
    );

CREATE POLICY "Admins can view all appointments" ON appointments
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
    );

-- ── Triggers ────────────────────────────────────────────────────────────────
CREATE TRIGGER update_appointments_updated_at
    BEFORE UPDATE ON appointments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_prevent_appointment_reassignment
    BEFORE UPDATE ON appointments
    FOR EACH ROW EXECUTE FUNCTION public.prevent_appointment_reassignment();
