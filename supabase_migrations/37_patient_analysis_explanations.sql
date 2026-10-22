BEGIN;

-- Owners may persist translated explanations, but not rewrite a signed review
-- or its underlying clinical findings.
CREATE OR REPLACE FUNCTION public.restrict_patient_analysis_writes()
RETURNS trigger
SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
  IF auth.uid() IS NULL OR public.is_admin(auth.uid()) THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.review_status <> 'pending_review'
      OR NEW.reviewer_id IS NOT NULL OR NEW.reviewer_name IS NOT NULL
      OR NEW.reviewer_badge IS NOT NULL OR NEW.reviewer_notes IS NOT NULL
      OR NEW.clinician_overrides IS NOT NULL OR NEW.reviewed_at IS NOT NULL
      OR NEW.verification_signature IS NOT NULL THEN
      RAISE EXCEPTION 'New assessments must await clinician review';
    END IF;
  ELSIF auth.uid() = OLD.user_id THEN
    IF (to_jsonb(NEW) - 'explanations' - 'updated_at')
      IS DISTINCT FROM (to_jsonb(OLD) - 'explanations' - 'updated_at') THEN
      RAISE EXCEPTION 'Patients may only update assessment explanations';
    END IF;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER restrict_patient_analysis_writes
  BEFORE INSERT OR UPDATE ON analyses
  FOR EACH ROW EXECUTE FUNCTION public.restrict_patient_analysis_writes();

CREATE POLICY "Users can save analysis explanations" ON analyses
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

COMMIT;
