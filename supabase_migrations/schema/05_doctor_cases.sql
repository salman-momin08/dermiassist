-- =====================================================
-- 05 · doctor_cases
-- =====================================================
-- Reconciles: 04_doctor_cases_table, 14_schema_fixes, 32_rls_policy_fixes,
--             34_migrate_analyses_to_partitioned (analysis composite FK).
-- Depends on: 00, 01 (profiles), 02 (appointments), 03 (connection_requests),
--             04 (analyses + set_analysis_reference_timestamp).

CREATE TABLE IF NOT EXISTS doctor_cases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    doctor_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    patient_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,

    -- Linked AI analysis (composite FK to the partitioned analyses table)
    analysis_id UUID,
    analysis_created_at TIMESTAMP WITH TIME ZONE,

    diagnosis TEXT,
    symptoms TEXT,
    treatment_plan TEXT,
    prescription TEXT,
    notes TEXT,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'archived')),
    follow_up_date DATE,
    follow_up_notes TEXT,
    patient_name TEXT,
    last_appointment_date TIMESTAMP WITH TIME ZONE,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    CONSTRAINT different_users CHECK (patient_id != doctor_id),
    CONSTRAINT doctor_cases_doctor_patient_unique UNIQUE (doctor_id, patient_id),
    CONSTRAINT doctor_cases_analysis_fkey
        FOREIGN KEY (analysis_id, analysis_created_at)
        REFERENCES analyses (id, created_at) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_doctor_cases_doctor ON doctor_cases(doctor_id);
CREATE INDEX IF NOT EXISTS idx_doctor_cases_patient ON doctor_cases(patient_id);
CREATE INDEX IF NOT EXISTS idx_doctor_cases_appointment ON doctor_cases(appointment_id);
CREATE INDEX IF NOT EXISTS idx_doctor_cases_status ON doctor_cases(status);
CREATE INDEX IF NOT EXISTS idx_doctor_cases_created ON doctor_cases(created_at DESC);

-- ── Row Level Security ──────────────────────────────────────────────────────
ALTER TABLE doctor_cases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Doctors can view own cases" ON doctor_cases
    FOR SELECT USING (
        auth.uid() = doctor_id
        AND EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'doctor')
    );

-- A verified doctor may only open a case for a patient they have an appointment
-- with or an accepted connection request from.
CREATE POLICY "Doctors can create cases" ON doctor_cases
    FOR INSERT WITH CHECK (
        auth.uid() = doctor_id
        AND EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid() AND profiles.role = 'doctor' AND profiles.verified = TRUE
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

CREATE POLICY "Doctors can update own cases" ON doctor_cases
    FOR UPDATE USING (
        auth.uid() = doctor_id
        AND EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'doctor')
    );

CREATE POLICY "Patients can view own cases" ON doctor_cases
    FOR SELECT USING (auth.uid() = patient_id);

CREATE POLICY "Admins can view all cases" ON doctor_cases
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
    );

-- ── Triggers ────────────────────────────────────────────────────────────────
CREATE TRIGGER update_doctor_cases_updated_at
    BEFORE UPDATE ON doctor_cases
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER doctor_cases_analysis_timestamp
    BEFORE INSERT OR UPDATE OF analysis_id ON doctor_cases
    FOR EACH ROW EXECUTE FUNCTION set_analysis_reference_timestamp();

-- ── Deferred profiles policy (needs both appointments and doctor_cases) ─────
-- Lets a doctor read the profile of any patient they have a case or appointment
-- with. Defined here because its USING clause references both tables.
CREATE POLICY "Doctors can view assigned patients" ON profiles
    FOR SELECT USING (
        role = 'patient'
        AND (
            EXISTS (
                SELECT 1 FROM doctor_cases
                WHERE doctor_cases.patient_id = profiles.id
                  AND doctor_cases.doctor_id = auth.uid()
            )
            OR EXISTS (
                SELECT 1 FROM appointments
                WHERE appointments.patient_id = profiles.id
                  AND appointments.doctor_id = auth.uid()
            )
        )
    );
