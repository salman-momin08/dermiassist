-- =====================================================
-- 10 · storage  (verification-docs bucket)
-- =====================================================
-- Reconciles: 07_storage_bucket.
-- Depends on: nothing (Supabase storage schema).

INSERT INTO storage.buckets (id, name, public)
VALUES ('verification-docs', 'verification-docs', TRUE)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated users can upload verification docs"
    ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'verification-docs' AND auth.role() = 'authenticated');

CREATE POLICY "Users can view verification docs"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'verification-docs');
