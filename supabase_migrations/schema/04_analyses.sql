-- =====================================================
-- 04 · analyses  (RANGE-partitioned by created_at)
-- =====================================================
-- Reconciles: 02_analyses_table, 30_partitioning_sharding, 33_fix_analyses_schema_drift,
--             34_migrate_analyses_to_partitioned, 36_add_report_verification,
--             37_patient_analysis_explanations.
-- This is the FINAL live table (migration 34 promoted analyses_partitioned to
-- `analyses`). Created fresh here as partitioned — there is no analyses_legacy
-- and no data backfill in a clean install.
-- Depends on: 00, 01 (profiles), 02 (appointments — doctor policies + composite FK).

CREATE TABLE IF NOT EXISTS analyses (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    condition_name TEXT NOT NULL,
    severity TEXT,
    confidence_score NUMERIC,
    image_url TEXT,
    image_public_id TEXT,
    report_data JSONB,
    date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Report content
    user_name TEXT,
    condition_description TEXT,
    image TEXT,
    recommendations TEXT,
    dos JSONB DEFAULT '[]'::jsonb,
    donts JSONB DEFAULT '[]'::jsonb,
    submitted_info JSONB DEFAULT '{}'::jsonb,
    explanations JSONB DEFAULT '{}'::jsonb,
    icd10_code TEXT,
    verification_signature TEXT,

    -- Clinician review lifecycle
    review_status TEXT NOT NULL DEFAULT 'pending_review'
        CHECK (review_status IN ('pending_review', 'in_review', 'released')),
    reviewer_id UUID REFERENCES profiles(id),
    reviewer_name TEXT,
    reviewer_badge TEXT,
    reviewer_notes TEXT,
    clinician_overrides JSONB,
    reviewed_at TIMESTAMP WITH TIME ZONE,

    PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- Quarterly partitions for 2026 + a catch-all default.
CREATE TABLE IF NOT EXISTS analyses_y2026_q1 PARTITION OF analyses
    FOR VALUES FROM ('2026-01-01 00:00:00+00') TO ('2026-04-01 00:00:00+00');
CREATE TABLE IF NOT EXISTS analyses_y2026_q2 PARTITION OF analyses
    FOR VALUES FROM ('2026-04-01 00:00:00+00') TO ('2026-07-01 00:00:00+00');
CREATE TABLE IF NOT EXISTS analyses_y2026_q3 PARTITION OF analyses
    FOR VALUES FROM ('2026-07-01 00:00:00+00') TO ('2026-10-01 00:00:00+00');
CREATE TABLE IF NOT EXISTS analyses_y2026_q4 PARTITION OF analyses
    FOR VALUES FROM ('2026-10-01 00:00:00+00') TO ('2027-01-01 00:00:00+00');
CREATE TABLE IF NOT EXISTS analyses_default PARTITION OF analyses DEFAULT;

CREATE INDEX IF NOT EXISTS idx_analyses_part_user_date ON analyses (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analyses_part_condition ON analyses (condition_name);

-- ── Row Level Security (parent + each partition) ────────────────────────────
ALTER TABLE analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE analyses_y2026_q1 ENABLE ROW LEVEL SECURITY;
ALTER TABLE analyses_y2026_q2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE analyses_y2026_q3 ENABLE ROW LEVEL SECURITY;
ALTER TABLE analyses_y2026_q4 ENABLE ROW LEVEL SECURITY;
ALTER TABLE analyses_default ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE analyses_y2026_q1, analyses_y2026_q2, analyses_y2026_q3, analyses_y2026_q4, analyses_default
    FROM anon, authenticated;

CREATE POLICY "Users can view own analyses" ON analyses
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create analyses" ON analyses
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own analyses" ON analyses
    FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Users can save analysis explanations" ON analyses
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Doctors can view patient analyses" ON analyses
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'doctor')
        AND EXISTS (SELECT 1 FROM appointments WHERE patient_id = analyses.user_id AND doctor_id = auth.uid())
    );
CREATE POLICY "Doctors can release reviewed analyses" ON analyses
    FOR UPDATE
    USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'doctor' AND verified = TRUE)
        AND EXISTS (SELECT 1 FROM appointments WHERE patient_id = analyses.user_id AND doctor_id = auth.uid())
    )
    WITH CHECK (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'doctor' AND verified = TRUE)
        AND EXISTS (SELECT 1 FROM appointments WHERE patient_id = analyses.user_id AND doctor_id = auth.uid())
    );
CREATE POLICY "Admins can view all analyses" ON analyses
    FOR SELECT USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins can update all analyses" ON analyses
    FOR UPDATE USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- ── Write-restriction: owners may only persist `explanations` ───────────────
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

CREATE TRIGGER update_analyses_updated_at
    BEFORE UPDATE ON analyses FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER restrict_patient_analysis_writes
    BEFORE INSERT OR UPDATE ON analyses FOR EACH ROW EXECUTE FUNCTION public.restrict_patient_analysis_writes();

-- ── Composite-FK plumbing for referencing tables ────────────────────────────
-- Postgres FK targets on a partitioned table must include the partition key, so
-- referencing rows carry a paired *_created_at column that this trigger fills in
-- from the analysis id (clients only send the id).
CREATE OR REPLACE FUNCTION set_analysis_reference_timestamp()
RETURNS trigger
SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_TABLE_NAME = 'appointments' THEN
    NEW.attached_report_created_at := NULL;
    IF NEW.attached_report_id IS NOT NULL THEN
      SELECT created_at INTO STRICT NEW.attached_report_created_at
        FROM analyses WHERE id = NEW.attached_report_id;
    END IF;
  ELSE
    NEW.analysis_created_at := NULL;
    IF NEW.analysis_id IS NOT NULL THEN
      SELECT created_at INTO STRICT NEW.analysis_created_at
        FROM analyses WHERE id = NEW.analysis_id;
    END IF;
  END IF;
  RETURN NEW;
END; $$;

-- appointments -> analyses (doctor_cases FK is added in 05, after that table exists)
ALTER TABLE appointments
    ADD CONSTRAINT appointments_attached_report_fkey
    FOREIGN KEY (attached_report_id, attached_report_created_at)
    REFERENCES analyses (id, created_at) ON DELETE SET NULL;

CREATE TRIGGER appointments_analysis_timestamp
    BEFORE INSERT OR UPDATE OF attached_report_id ON appointments
    FOR EACH ROW EXECUTE FUNCTION set_analysis_reference_timestamp();

-- ── Partition maintenance (keep future quarters ahead of the data) ──────────
CREATE OR REPLACE FUNCTION create_next_analyses_partition()
RETURNS void
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
  next_start date := date_trunc('quarter', now() + interval '3 months');
  next_end date := next_start + interval '3 months';
  partition_name text := 'analyses_' || to_char(next_start, 'YYYY') || '_q' || to_char(next_start, 'Q');
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = partition_name) THEN
    EXECUTE format(
      'CREATE TABLE IF NOT EXISTS %I PARTITION OF analyses FOR VALUES FROM (%L) TO (%L)',
      partition_name, next_start, next_end
    );
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', partition_name);
    EXECUTE format('REVOKE ALL ON TABLE %I FROM anon, authenticated', partition_name);
  END IF;
END; $$;
REVOKE ALL ON FUNCTION create_next_analyses_partition() FROM PUBLIC;

-- Requires pg_cron. On Supabase enable it from Database > Extensions if the next
-- line errors with "extension does not exist".
CREATE EXTENSION IF NOT EXISTS pg_cron;
SELECT cron.schedule(
  'ensure-future-analyses-partitions',
  '0 3 1 * *', -- 03:00 UTC on the 1st of every month
  $$SELECT create_next_analyses_partition();$$
);

-- ── Public report-verification RPC (anonymous, non-sensitive columns only) ──
DROP FUNCTION IF EXISTS get_report_verification_summary(uuid);
CREATE OR REPLACE FUNCTION get_report_verification_summary(p_analysis_id uuid, p_signature text)
RETURNS TABLE (
  found boolean,
  condition_name text,
  review_status text,
  reviewer_name text,
  reviewer_badge text,
  report_date timestamptz,
  reviewed_at timestamptz,
  stored_signature text
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT true, a.condition_name, a.review_status, a.reviewer_name, a.reviewer_badge,
         a.date, a.reviewed_at, a.verification_signature
  FROM analyses a
  WHERE a.id = p_analysis_id
    AND a.review_status = 'released'
    AND a.verification_signature = p_signature
    AND length(p_signature) = 64;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::text, NULL::text, NULL::text, NULL::text,
                        NULL::timestamptz, NULL::timestamptz, NULL::text;
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION get_report_verification_summary(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_report_verification_summary(uuid, text) TO anon, authenticated;
