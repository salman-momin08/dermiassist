-- Refine connection_requests RLS policies
-- Drops existing policies and recreates them with better naming and coverage

-- Drop existing policies
DROP POLICY IF EXISTS "Patients can view their own requests" ON connection_requests;
DROP POLICY IF EXISTS "Doctors can view requests sent to them" ON connection_requests;
DROP POLICY IF EXISTS "Patients can cancel/create requests" ON connection_requests;
DROP POLICY IF EXISTS "Doctors can update status" ON connection_requests;

-- 1. Patients can view their own requests
CREATE POLICY "connection_requests_patient_select"
  ON connection_requests FOR SELECT
  USING (auth.uid() = patient_id);

-- 2. Doctors can view requests sent to them
CREATE POLICY "connection_requests_doctor_select"
  ON connection_requests FOR SELECT
  USING (auth.uid() = doctor_id);

-- 3. Patients can insert connection requests
-- WITH CHECK ensures the patient_id matches the authenticated user
CREATE POLICY "connection_requests_patient_insert"
  ON connection_requests FOR INSERT
  WITH CHECK (auth.uid() = patient_id);

-- 4. Patients can delete (cancel) their own pending requests
CREATE POLICY "connection_requests_patient_delete"
  ON connection_requests FOR DELETE
  USING (auth.uid() = patient_id AND status = 'pending');

-- 5. Doctors can update status of requests sent to them
-- Typically they only change status from 'pending' to 'accepted' or 'rejected'
CREATE POLICY "connection_requests_doctor_update"
  ON connection_requests FOR UPDATE
  USING (auth.uid() = doctor_id);

-- Add performance indexes if missing
CREATE INDEX IF NOT EXISTS idx_connection_requests_patient_id ON connection_requests(patient_id);
CREATE INDEX IF NOT EXISTS idx_connection_requests_doctor_id ON connection_requests(doctor_id);
CREATE INDEX IF NOT EXISTS idx_connection_requests_status ON connection_requests(status);
