-- =====================================================
-- 07 · doctor_reviews  (+ public_doctor_reviews view)
-- =====================================================
-- Reconciles: 15_doctor_reviews_table, 32_rls_policy_fixes.
-- Depends on: 00, 01 (profiles).
-- Security note: the table has NO blanket public SELECT policy (that would leak
-- the private `feedback` column and patient_id). Public listings read the
-- column-limited `public_doctor_reviews` view instead.

CREATE TABLE IF NOT EXISTS doctor_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    doctor_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    patient_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    kudos TEXT,      -- Public testimonial
    feedback TEXT,   -- Private feedback
    is_public BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_doctor_reviews_doctor_id ON doctor_reviews(doctor_id);
CREATE INDEX IF NOT EXISTS idx_doctor_reviews_rating ON doctor_reviews(rating);

-- ── Row Level Security ──────────────────────────────────────────────────────
ALTER TABLE doctor_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Patients can view own reviews" ON doctor_reviews
    FOR SELECT USING (auth.uid() = patient_id);

CREATE POLICY "Patients can create reviews" ON doctor_reviews
    FOR INSERT WITH CHECK (auth.uid() = patient_id);

CREATE POLICY "Patients can update own reviews" ON doctor_reviews
    FOR UPDATE USING (auth.uid() = patient_id);

CREATE POLICY "Doctors can view reviews about themselves" ON doctor_reviews
    FOR SELECT USING (auth.uid() = doctor_id);

-- Public-safe projection: no feedback text, no patient_id.
CREATE OR REPLACE VIEW public_doctor_reviews AS
SELECT id, doctor_id, rating, kudos, created_at
FROM doctor_reviews
WHERE is_public = TRUE;

GRANT SELECT ON public_doctor_reviews TO anon, authenticated;

-- ── Triggers ────────────────────────────────────────────────────────────────
CREATE TRIGGER update_doctor_reviews_updated_at
    BEFORE UPDATE ON doctor_reviews
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
