-- =====================================================
-- Doctor Cases Table Migration
-- =====================================================
-- This migration creates the doctor_cases table for managing
-- patient cases and treatment plans by doctors.

-- Create doctor_cases table
CREATE TABLE IF NOT EXISTS doctor_cases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Participants
    doctor_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    patient_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    
    -- Related appointment
    appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
    
    -- Case details
    diagnosis TEXT,
    symptoms TEXT,
    treatment_plan TEXT,
    prescription TEXT,
    notes TEXT,
    
    -- Case status
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'archived')),
    
    -- Follow-up
    follow_up_date DATE,
    follow_up_notes TEXT,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT different_users CHECK (patient_id != doctor_id)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_doctor_cases_doctor ON doctor_cases(doctor_id);
CREATE INDEX IF NOT EXISTS idx_doctor_cases_patient ON doctor_cases(patient_id);
CREATE INDEX IF NOT EXISTS idx_doctor_cases_appointment ON doctor_cases(appointment_id);
CREATE INDEX IF NOT EXISTS idx_doctor_cases_status ON doctor_cases(status);
CREATE INDEX IF NOT EXISTS idx_doctor_cases_created ON doctor_cases(created_at DESC);

-- Enable Row Level Security
ALTER TABLE doctor_cases ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Doctors can view own cases" ON doctor_cases;
DROP POLICY IF EXISTS "Doctors can create cases" ON doctor_cases;
DROP POLICY IF EXISTS "Doctors can update own cases" ON doctor_cases;
DROP POLICY IF EXISTS "Patients can view own cases" ON doctor_cases;
DROP POLICY IF EXISTS "Admins can view all cases" ON doctor_cases;

-- Doctors can view cases where they are the doctor
CREATE POLICY "Doctors can view own cases" ON doctor_cases
    FOR SELECT
    USING (
        auth.uid() = doctor_id
        AND EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'doctor'
        )
    );

-- Doctors can create cases
CREATE POLICY "Doctors can create cases" ON doctor_cases
    FOR INSERT
    WITH CHECK (
        auth.uid() = doctor_id
        AND EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'doctor'
        )
    );

-- Doctors can update their own cases
CREATE POLICY "Doctors can update own cases" ON doctor_cases
    FOR UPDATE
    USING (
        auth.uid() = doctor_id
        AND EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'doctor'
        )
    );

-- Patients can view cases where they are the patient
CREATE POLICY "Patients can view own cases" ON doctor_cases
    FOR SELECT
    USING (auth.uid() = patient_id);

-- Admins can view all cases
CREATE POLICY "Admins can view all cases" ON doctor_cases
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- Trigger to update updated_at
DROP TRIGGER IF EXISTS update_doctor_cases_updated_at ON doctor_cases;
CREATE TRIGGER update_doctor_cases_updated_at
    BEFORE UPDATE ON doctor_cases
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add table and column comments
COMMENT ON TABLE doctor_cases IS 'Patient cases managed by doctors';
COMMENT ON COLUMN doctor_cases.diagnosis IS 'Medical diagnosis for the case';
COMMENT ON COLUMN doctor_cases.treatment_plan IS 'Prescribed treatment plan';
COMMENT ON COLUMN doctor_cases.status IS 'Case status: active, completed, or archived';

-- =====================================================
-- Migration Complete
-- =====================================================
