-- 34_migrate_analyses_to_partitioned.sql
--
-- Closes the "orphaned partitioning table" gap: 30_partitioning_sharding.sql
-- created a real, valid `analyses_partitioned` table that nothing in the app
-- ever referenced. This migration actually wires it in, by making it the live
-- `analyses` table instead of a decorative sibling.
--
-- IMPORTANT: this is a real data migration that restructures two foreign keys.
-- Test it against a Supabase branch/staging project before running on
-- production. `analyses_legacy` is kept (not dropped) at the end specifically
-- so this is reversible if something looks wrong after the swap.
--
-- Depends on 33_fix_analyses_schema_drift.sql having already run (it backfills
-- the review_status/reviewer_*/clinician_overrides/reviewed_at columns that
-- migration introduces).

BEGIN;
LOCK TABLE analyses, analyses_partitioned, appointments, doctor_cases IN ACCESS EXCLUSIVE MODE;

-- ── 1. Bring analyses_partitioned's schema in line with live `analyses` ─────
ALTER TABLE analyses_partitioned
  ALTER COLUMN severity DROP NOT NULL,
  ALTER COLUMN confidence_score DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS user_name TEXT,
  ADD COLUMN IF NOT EXISTS condition_description TEXT,
  ADD COLUMN IF NOT EXISTS image TEXT,
  ADD COLUMN IF NOT EXISTS image_public_id TEXT,
  ADD COLUMN IF NOT EXISTS recommendations TEXT,
  ADD COLUMN IF NOT EXISTS dos JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS donts JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS submitted_info JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS explanations JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS icd10_code TEXT,
  ADD COLUMN IF NOT EXISTS date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS review_status TEXT DEFAULT 'pending_review',
  ADD COLUMN IF NOT EXISTS reviewer_id UUID,
  ADD COLUMN IF NOT EXISTS reviewer_name TEXT,
  ADD COLUMN IF NOT EXISTS reviewer_badge TEXT,
  ADD COLUMN IF NOT EXISTS reviewer_notes TEXT,
  ADD COLUMN IF NOT EXISTS clinician_overrides JSONB,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS verification_signature TEXT;

-- ── 2. Backfill existing rows ───────────────────────────────────────────────
INSERT INTO analyses_partitioned (
  id, user_id, condition_name, severity, confidence_score, image_url, report_data,
  date, created_at, updated_at, review_status, reviewer_id, reviewer_name,
  reviewer_badge, reviewer_notes, clinician_overrides, reviewed_at,
  user_name, condition_description, image, image_public_id, recommendations,
  dos, donts, submitted_info, explanations, icd10_code, verification_signature
)
SELECT
  id, user_id, condition_name, severity, confidence_score, image_url, report_data,
  date, created_at, updated_at, review_status, reviewer_id, reviewer_name,
  reviewer_badge, reviewer_notes, clinician_overrides, reviewed_at,
  user_name, condition_description, image, image_public_id, recommendations,
  to_jsonb(dos), to_jsonb(donts), submitted_info, explanations, icd10_code, verification_signature
FROM analyses
ON CONFLICT (id, created_at) DO NOTHING;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM analyses a
    LEFT JOIN analyses_partitioned p ON p.id = a.id AND p.created_at = a.created_at
    WHERE p.id IS NULL
  ) THEN
    RAISE EXCEPTION 'Partition migration did not copy every assessment';
  END IF;
END; $$;

-- ── 3. Composite-FK plumbing ─────────────────────────────────────────────────
-- Postgres requires FK targets on a partitioned table to include the partition
-- key (created_at), so referencing tables need a paired *_created_at column.
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS attached_report_created_at TIMESTAMP WITH TIME ZONE;
UPDATE appointments a
  SET attached_report_created_at = an.created_at
  FROM analyses an
  WHERE an.id = a.attached_report_id AND a.attached_report_created_at IS NULL;
ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_attached_report_id_fkey;

ALTER TABLE doctor_cases ADD COLUMN IF NOT EXISTS analysis_created_at TIMESTAMP WITH TIME ZONE;
UPDATE doctor_cases dc
  SET analysis_created_at = an.created_at
  FROM analyses an
  WHERE an.id = dc.analysis_id AND dc.analysis_created_at IS NULL;
ALTER TABLE doctor_cases DROP CONSTRAINT IF EXISTS doctor_cases_analysis_id_fkey;

-- ── 4. RLS on analyses_partitioned (it currently has none — fine only because
--       nothing used it; that stops being true after this migration) ─────────
ALTER TABLE analyses_partitioned ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own analyses" ON analyses_partitioned
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create analyses" ON analyses_partitioned
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own analyses" ON analyses_partitioned
  FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Doctors can view patient analyses" ON analyses_partitioned
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'doctor')
    AND EXISTS (SELECT 1 FROM appointments WHERE patient_id = analyses_partitioned.user_id AND doctor_id = auth.uid())
  );
CREATE POLICY "Doctors can release reviewed analyses" ON analyses_partitioned
  FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'doctor' AND verified = true)
    AND EXISTS (SELECT 1 FROM appointments WHERE patient_id = analyses_partitioned.user_id AND doctor_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'doctor' AND verified = true)
    AND EXISTS (SELECT 1 FROM appointments WHERE patient_id = analyses_partitioned.user_id AND doctor_id = auth.uid())
  );
CREATE POLICY "Admins can view all analyses" ON analyses_partitioned
  FOR SELECT USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins can update all analyses" ON analyses_partitioned
  FOR UPDATE USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- ── 5. Swap the tables ───────────────────────────────────────────────────────
-- Postgres partitioning is transparent to PostgREST/Supabase clients, so every
-- existing `.from('analyses')` call in the app (src/hooks/use-analyses.ts,
-- doctor review pages, admin telemetry, eval harnesses) keeps working unchanged
-- after this rename. analyses_legacy is intentionally kept, not dropped.
ALTER TABLE analyses RENAME TO analyses_legacy;
ALTER TABLE analyses_partitioned RENAME TO analyses;
REVOKE ALL ON TABLE analyses_legacy FROM anon, authenticated;

DO $$
DECLARE
  child record;
BEGIN
  FOR child IN SELECT relid::regclass AS relation FROM pg_partition_tree('analyses'::regclass) WHERE isleaf
  LOOP
    EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', child.relation);
    EXECUTE format('REVOKE ALL ON TABLE %s FROM anon, authenticated', child.relation);
  END LOOP;
END; $$;

ALTER TABLE analyses
  ADD CONSTRAINT analyses_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE,
  ADD CONSTRAINT analyses_reviewer_id_fkey FOREIGN KEY (reviewer_id) REFERENCES profiles(id);

CREATE TRIGGER update_analyses_updated_at
  BEFORE UPDATE ON analyses FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE appointments
  ADD CONSTRAINT appointments_attached_report_fkey
  FOREIGN KEY (attached_report_id, attached_report_created_at)
  REFERENCES analyses (id, created_at) ON DELETE SET NULL;

-- Existing clients send report IDs only. Fill the partition key on every new
-- reference so MATCH SIMPLE cannot silently skip composite FK enforcement.
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

CREATE TRIGGER appointments_analysis_timestamp
  BEFORE INSERT OR UPDATE OF attached_report_id ON appointments
  FOR EACH ROW EXECUTE FUNCTION set_analysis_reference_timestamp();
CREATE TRIGGER doctor_cases_analysis_timestamp
  BEFORE INSERT OR UPDATE OF analysis_id ON doctor_cases
  FOR EACH ROW EXECUTE FUNCTION set_analysis_reference_timestamp();

-- Publications track table OIDs, not names; the rename alone leaves realtime
-- clients subscribed to the archived table.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime' AND NOT puballtables) THEN
    IF EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'analyses_legacy') THEN
      ALTER PUBLICATION supabase_realtime DROP TABLE analyses_legacy;
    END IF;
    ALTER PUBLICATION supabase_realtime ADD TABLE analyses;
  END IF;
END; $$;

ALTER TABLE doctor_cases
  ADD CONSTRAINT doctor_cases_analysis_fkey
  FOREIGN KEY (analysis_id, analysis_created_at)
  REFERENCES analyses (id, created_at) ON DELETE SET NULL;

-- ── 6. Keep future partitions ahead of the data ──────────────────────────────
-- This is the part that actually matters for "production" range partitioning:
-- without it, inserts start failing the moment the pre-created quarters run out.
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

-- Requires the pg_cron extension. On Supabase, enable it from
-- Database > Extensions if the next line errors with "extension does not exist".
CREATE EXTENSION IF NOT EXISTS pg_cron;
SELECT cron.schedule(
  'ensure-future-analyses-partitions',
  '0 3 1 * *', -- 03:00 UTC on the 1st of every month
  $$SELECT create_next_analyses_partition();$$
);

COMMIT;

-- ── Cleanup (do this later, manually, once the app is confirmed working) ────
-- DROP TABLE analyses_legacy;
