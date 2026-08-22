-- =====================================================
-- Appointments Table Migration
-- =====================================================
-- This migration creates the appointments table for managing
-- doctor-patient consultations (online and offline).

-- Create appointments table
CREATE TABLE IF NOT EXISTS appointments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Participants
    patient_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    doctor_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    
    -- Appointment details
    date DATE NOT NULL,
    time TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('online', 'offline')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled')),
    
    -- Additional information
    notes TEXT,
    patient_notes TEXT,
    doctor_notes TEXT,
    
    -- Video consultation (for online appointments)
    channel_name TEXT,
    agora_token TEXT,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT different_users CHECK (patient_id != doctor_id)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_appointments_patient ON appointments(patient_id);
CREATE INDEX IF NOT EXISTS idx_appointments_doctor ON appointments(doctor_id);
CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(date DESC);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);
CREATE INDEX IF NOT EXISTS idx_appointments_type ON appointments(type);

-- Enable Row Level Security
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Patients can view own appointments" ON appointments;
DROP POLICY IF EXISTS "Doctors can view own appointments" ON appointments;
DROP POLICY IF EXISTS "Patients can create appointments" ON appointments;
DROP POLICY IF EXISTS "Patients can update own appointments" ON appointments;
DROP POLICY IF EXISTS "Doctors can update appointments" ON appointments;
DROP POLICY IF EXISTS "Admins can view all appointments" ON appointments;

-- Patients can view their own appointments
CREATE POLICY "Patients can view own appointments" ON appointments
    FOR SELECT
    USING (auth.uid() = patient_id);

-- Doctors can view appointments where they are the doctor
CREATE POLICY "Doctors can view own appointments" ON appointments
    FOR SELECT
    USING (auth.uid() = doctor_id);

-- Patients can create appointments
CREATE POLICY "Patients can create appointments" ON appointments
    FOR INSERT
    WITH CHECK (
        auth.uid() = patient_id
        AND EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'patient'
        )
    );

-- Patients can update their own pending appointments
CREATE POLICY "Patients can update own appointments" ON appointments
    FOR UPDATE
    USING (
        auth.uid() = patient_id
        AND status = 'pending'
    );

-- Doctors can update appointments where they are the doctor
CREATE POLICY "Doctors can update appointments" ON appointments
    FOR UPDATE
    USING (
        auth.uid() = doctor_id
        AND EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'doctor'
        )
    );

-- Admins can view all appointments
CREATE POLICY "Admins can view all appointments" ON appointments
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- Trigger to update updated_at
DROP TRIGGER IF EXISTS update_appointments_updated_at ON appointments;
CREATE TRIGGER update_appointments_updated_at
    BEFORE UPDATE ON appointments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add table and column comments
COMMENT ON TABLE appointments IS 'Doctor-patient appointments for consultations';
COMMENT ON COLUMN appointments.type IS 'Appointment type: online or offline';
COMMENT ON COLUMN appointments.status IS 'Appointment status: pending, confirmed, completed, or cancelled';
COMMENT ON COLUMN appointments.channel_name IS 'Agora video channel name for online appointments';

-- =====================================================
-- Migration Complete
-- =====================================================
