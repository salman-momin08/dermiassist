-- =====================================================
-- Contact Requests Table Migration
-- =====================================================
-- This migration creates the contact_requests table for storing
-- user contact requests (enquiries, role changes, technical support, feedback)
-- with admin approval workflow and document upload functionality.
--
-- CONSOLIDATED MIGRATION:
-- This file combines functionality from:
-- - contact_requests_table.sql (base table)
-- - 07_update_contact_requests_status.sql (status enum)
-- - 08_add_user_update_policy.sql (user update policy)
-- =====================================================

-- Create contact_requests table
CREATE TABLE IF NOT EXISTS contact_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- User information
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    user_name TEXT NOT NULL,
    user_email TEXT NOT NULL,
    
    -- Request details
    request_type TEXT NOT NULL CHECK (request_type IN ('enquiry', 'role-change', 'technical-support', 'feedback')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (
        status IN ('pending', 'approved', 'rejected', 'approved_for_docs', 'verification_pending')
    ),
    
    -- Request data (JSON)
    data JSONB NOT NULL,
    
    -- Admin actions
    admin_notes TEXT,
    reviewed_by UUID REFERENCES profiles(id),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_contact_requests_user ON contact_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_contact_requests_type ON contact_requests(request_type);
CREATE INDEX IF NOT EXISTS idx_contact_requests_status ON contact_requests(status);
CREATE INDEX IF NOT EXISTS idx_contact_requests_created ON contact_requests(created_at DESC);

-- Enable Row Level Security
ALTER TABLE contact_requests ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for re-running migration)
DROP POLICY IF EXISTS "Users can view own requests" ON contact_requests;
DROP POLICY IF EXISTS "Users can create requests" ON contact_requests;
DROP POLICY IF EXISTS "Users can update own requests" ON contact_requests;
DROP POLICY IF EXISTS "Admins can view all requests" ON contact_requests;
DROP POLICY IF EXISTS "Admins can update requests" ON contact_requests;

-- Users can view their own requests
CREATE POLICY "Users can view own requests" ON contact_requests
    FOR SELECT
    USING (auth.uid() = user_id);

-- Users can create requests
CREATE POLICY "Users can create requests" ON contact_requests
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Users can update their own requests (for document uploads)
-- This is specifically needed for document uploads when status is approved_for_docs
CREATE POLICY "Users can update own requests" ON contact_requests
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (
        auth.uid() = user_id 
        AND status IN ('approved_for_docs', 'verification_pending')
    );

-- Admins can view all requests
CREATE POLICY "Admins can view all requests" ON contact_requests
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- Admins can update requests (approve/reject)
CREATE POLICY "Admins can update requests" ON contact_requests
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- Trigger to update updated_at
DROP TRIGGER IF EXISTS update_contact_requests_updated_at ON contact_requests;
CREATE TRIGGER update_contact_requests_updated_at
    BEFORE UPDATE ON contact_requests
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add table and column comments for documentation
COMMENT ON TABLE contact_requests IS 'Stores user contact requests for admin review and approval';
COMMENT ON COLUMN contact_requests.user_id IS 'Reference to the user who submitted the request';
COMMENT ON COLUMN contact_requests.request_type IS 'Type of request: enquiry, role-change, technical-support, or feedback';
COMMENT ON COLUMN contact_requests.status IS 'Request status: pending, approved, rejected, approved_for_docs (admin allowed upload), verification_pending (docs uploaded, awaiting final review)';
COMMENT ON COLUMN contact_requests.data IS 'JSON object containing request-specific data (form fields)';
COMMENT ON COLUMN contact_requests.admin_notes IS 'Optional notes added by admin when reviewing';
COMMENT ON COLUMN contact_requests.reviewed_by IS 'Admin user who reviewed the request';
COMMENT ON COLUMN contact_requests.reviewed_at IS 'Timestamp when request was reviewed';

-- =====================================================
-- Migration Complete
-- =====================================================
-- This migration creates the complete contact_requests system with:
-- 1. Table structure for all request types
-- 2. Expanded status enum for document upload workflow
-- 3. RLS policies for users and admins
-- 4. User update policy for document uploads
-- 5. Indexes for performance
-- 6. Automatic updated_at trigger
-- =====================================================
