-- =====================================================
-- Fix RLS Policies for Doctor-Patient Access
-- =====================================================
-- This migration adds missing RLS policies to allow doctors to view
-- profiles of patients they are treating or have appointments with.
-- =====================================================

-- 1. Allow Doctors to view Patient Profiles
-- Doctors need to see profile details (photo, bio, etc.) of their patients.
-- Access is granted if a doctor has a case or an appointment with the patient.

CREATE POLICY "Doctors can view assigned patients" ON profiles
    FOR SELECT
    USING (
        role = 'patient' 
        AND (
            EXISTS (
                SELECT 1 FROM doctor_cases
                WHERE doctor_cases.patient_id = profiles.id
                AND doctor_cases.doctor_id = auth.uid()
            )
            OR
            EXISTS (
                SELECT 1 FROM appointments
                WHERE appointments.patient_id = profiles.id
                AND appointments.doctor_id = auth.uid()
            )
        )
    );

COMMENT ON POLICY "Doctors can view assigned patients" ON profiles IS 'Allows doctors to view profiles of patients they have cases or appointments with';

-- =====================================================
-- Migration Complete
-- =====================================================
