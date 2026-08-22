-- =====================================================
-- Schema Fixes for Application Compatibility
-- =====================================================
-- This migration adds missing columns and constraints identified
-- during codebase analysis to ensure all application queries work correctly.
-- =====================================================

-- 1. Update Appointments Table
-- Add columns used in DoctorAppointmentsPage and Patient AppointmentsPage
ALTER TABLE appointments 
ADD COLUMN IF NOT EXISTS appointment_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS prescription JSONB,
ADD COLUMN IF NOT EXISTS doctor_name TEXT,
ADD COLUMN IF NOT EXISTS patient_name TEXT,
ADD COLUMN IF NOT EXISTS doctor_location TEXT,
ADD COLUMN IF NOT EXISTS doctor_phone TEXT,
ADD COLUMN IF NOT EXISTS doctor_signature TEXT,
ADD COLUMN IF NOT EXISTS appointment_mode TEXT;

COMMENT ON COLUMN appointments.appointment_date IS 'Confirmed date and time of the appointment';
COMMENT ON COLUMN appointments.prescription IS 'E-prescription data (medication, dosage, instructions)';
COMMENT ON COLUMN appointments.doctor_name IS 'Cached doctor name';
COMMENT ON COLUMN appointments.patient_name IS 'Cached patient name';
COMMENT ON COLUMN appointments.doctor_location IS 'Doctor clinic location snapshot';
COMMENT ON COLUMN appointments.doctor_phone IS 'Doctor contact snapshot';
COMMENT ON COLUMN appointments.doctor_signature IS 'Doctor signature URL snapshot';
COMMENT ON COLUMN appointments.appointment_mode IS 'Online or Offline mode (supplements type column)';

-- 2. Update Doctor Cases Table
-- Add columns used in DoctorCasesPage
ALTER TABLE doctor_cases 
ADD COLUMN IF NOT EXISTS patient_name TEXT,
ADD COLUMN IF NOT EXISTS last_appointment_date TIMESTAMP WITH TIME ZONE;

COMMENT ON COLUMN doctor_cases.patient_name IS 'Cached patient name for easier display';
COMMENT ON COLUMN doctor_cases.last_appointment_date IS 'Timestamp of the most recent appointment';

-- Add Unique Constraint for Upsert
-- Required for: .upsert({ ... }, { onConflict: 'doctor_id,patient_id' })
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'doctor_cases_doctor_patient_unique'
    ) THEN
        ALTER TABLE doctor_cases
        ADD CONSTRAINT doctor_cases_doctor_patient_unique UNIQUE (doctor_id, patient_id);
    END IF;
END $$;

COMMENT ON CONSTRAINT doctor_cases_doctor_patient_unique ON doctor_cases IS 'Ensures one case record per doctor-patient pair';

-- 3. Update Connection Requests Table
-- Add trigger for updated_at
DROP TRIGGER IF EXISTS update_connection_requests_updated_at ON connection_requests;
CREATE TRIGGER update_connection_requests_updated_at
    BEFORE UPDATE ON connection_requests
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- Migration Complete
-- =====================================================
