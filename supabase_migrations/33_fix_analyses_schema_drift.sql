-- 33_fix_analyses_schema_drift.sql
--
-- The doctor case-release flow (src/app/doctor/cases/[id]/page.tsx, handleReleaseCase)
-- writes review_status / reviewer_id / reviewer_name / reviewer_badge /
-- reviewer_notes / clinician_overrides / reviewed_at onto the `analyses` table --
-- but none of these columns exist in any prior migration. This is real schema drift: they were
-- evidently added ad hoc (e.g. via the Supabase dashboard) and never captured in
-- version control. This migration codifies them, and adds the RLS UPDATE policy
-- that was also missing (the `analyses` table previously had no UPDATE policy at
-- all, which would have caused every doctor "release case" write to be silently
-- rejected by RLS with 0 rows affected).

ALTER TABLE analyses
  ADD COLUMN IF NOT EXISTS user_name TEXT,
  ADD COLUMN IF NOT EXISTS condition_description TEXT,
  ADD COLUMN IF NOT EXISTS image TEXT,
  ADD COLUMN IF NOT EXISTS recommendations TEXT,
  ADD COLUMN IF NOT EXISTS dos JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS donts JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS submitted_info JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS explanations JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS icd10_code TEXT,
  ADD COLUMN IF NOT EXISTS verification_signature TEXT,
  ADD COLUMN IF NOT EXISTS review_status TEXT NOT NULL DEFAULT 'pending_review'
    CHECK (review_status IN ('pending_review', 'in_review', 'released')),
  ADD COLUMN IF NOT EXISTS reviewer_id UUID REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS reviewer_name TEXT,
  ADD COLUMN IF NOT EXISTS reviewer_badge TEXT,
  ADD COLUMN IF NOT EXISTS reviewer_notes TEXT,
  ADD COLUMN IF NOT EXISTS clinician_overrides JSONB,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP WITH TIME ZONE;

UPDATE analyses SET image = image_url WHERE image IS NULL;

COMMENT ON COLUMN analyses.review_status IS 'AI report review lifecycle: pending_review -> in_review -> released by a doctor.';
COMMENT ON COLUMN analyses.clinician_overrides IS 'JSON blob of any doctor edits to condition/ICD-10/severity/recommendations made during release.';

-- The release flow only touches these specific fields for a patient whose
-- analyses the doctor already has a legitimate relationship with (mirrors the
-- existing "Doctors can view patient analyses" SELECT policy's relationship
-- gate) -- doctors cannot release a report for a patient they have no
-- appointment with, and cannot change ownership (user_id) of the row.
CREATE POLICY "Doctors can release reviewed analyses" ON analyses
  FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'doctor' AND verified = true)
    AND EXISTS (SELECT 1 FROM appointments WHERE patient_id = analyses.user_id AND doctor_id = auth.uid())
  )
  WITH CHECK (
    -- WITH CHECK re-validates the same relationship against the *new* row so a
    -- doctor cannot use this policy to reassign the analysis to a different
    -- patient_id/user_id they don't have a relationship with (same reasoning as
    -- the reassignment-prevention triggers added in 32_rls_policy_fixes.sql).
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'doctor' AND verified = true)
    AND EXISTS (SELECT 1 FROM appointments WHERE patient_id = analyses.user_id AND doctor_id = auth.uid())
  );

-- Admins retain their existing blanket access via public.is_admin(); no change
-- needed there since the admin SELECT policy already exists and this migration
-- only adds the doctor-facing UPDATE policy that was missing.
CREATE POLICY "Admins can update all analyses" ON analyses
  FOR UPDATE USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));
