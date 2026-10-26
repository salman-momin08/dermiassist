-- =====================================================
-- 06 · contact_requests  (enquiries / role-change / support / feedback)
-- =====================================================
-- Reconciles: 05_contact_requests_table, 09_admin_rls_policies.
-- Depends on: 00, 01 (profiles, is_admin).

CREATE TABLE IF NOT EXISTS contact_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    user_name TEXT NOT NULL,
    user_email TEXT NOT NULL,

    request_type TEXT NOT NULL CHECK (request_type IN ('enquiry', 'role-change', 'technical-support', 'feedback')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (
        status IN ('pending', 'approved', 'rejected', 'approved_for_docs', 'verification_pending')
    ),
    data JSONB NOT NULL,

    admin_notes TEXT,
    reviewed_by UUID REFERENCES profiles(id),
    reviewed_at TIMESTAMP WITH TIME ZONE,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contact_requests_user ON contact_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_contact_requests_type ON contact_requests(request_type);
CREATE INDEX IF NOT EXISTS idx_contact_requests_status ON contact_requests(status);
CREATE INDEX IF NOT EXISTS idx_contact_requests_created ON contact_requests(created_at DESC);

-- ── Row Level Security ──────────────────────────────────────────────────────
ALTER TABLE contact_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own requests" ON contact_requests
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create requests" ON contact_requests
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users may only self-update while uploading verification documents.
CREATE POLICY "Users can update own requests" ON contact_requests
    FOR UPDATE USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id AND status IN ('approved_for_docs', 'verification_pending'));

CREATE POLICY "Admins can view all requests" ON contact_requests
    FOR SELECT USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update requests" ON contact_requests
    FOR UPDATE USING (public.is_admin(auth.uid()))
    WITH CHECK (public.is_admin(auth.uid()));

-- ── Triggers ────────────────────────────────────────────────────────────────
CREATE TRIGGER update_contact_requests_updated_at
    BEFORE UPDATE ON contact_requests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
