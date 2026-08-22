-- =====================================================
-- Analyses Table Migration
-- =====================================================
-- This migration creates the analyses table for storing
-- AI skin analysis results and reports.

-- Create analyses table
CREATE TABLE IF NOT EXISTS analyses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- User reference
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    
    -- Analysis details
    condition_name TEXT NOT NULL,
    severity TEXT,
    confidence_score DECIMAL(5,2),
    
    -- Image data
    image_url TEXT NOT NULL,
    image_public_id TEXT,
    
    -- AI Report data (stored as JSON)
    report_data JSONB,
    
    -- Analysis metadata
    date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_analyses_user ON analyses(user_id);
CREATE INDEX IF NOT EXISTS idx_analyses_date ON analyses(date DESC);
CREATE INDEX IF NOT EXISTS idx_analyses_condition ON analyses(condition_name);

-- Enable Row Level Security
ALTER TABLE analyses ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own analyses" ON analyses;
DROP POLICY IF EXISTS "Users can create analyses" ON analyses;
DROP POLICY IF EXISTS "Users can delete own analyses" ON analyses;
DROP POLICY IF EXISTS "Doctors can view patient analyses" ON analyses;
DROP POLICY IF EXISTS "Admins can view all analyses" ON analyses;

-- Users can view their own analyses
CREATE POLICY "Users can view own analyses" ON analyses
    FOR SELECT
    USING (auth.uid() = user_id);

-- Users can create their own analyses
CREATE POLICY "Users can create analyses" ON analyses
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Users can delete their own analyses
CREATE POLICY "Users can delete own analyses" ON analyses
    FOR DELETE
    USING (auth.uid() = user_id);

-- Doctors can view analyses of their patients (through appointments)
CREATE POLICY "Doctors can view patient analyses" ON analyses
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'doctor'
        )
        AND EXISTS (
            SELECT 1 FROM appointments
            WHERE appointments.patient_id = analyses.user_id
            AND appointments.doctor_id = auth.uid()
        )
    );

-- Admins can view all analyses
CREATE POLICY "Admins can view all analyses" ON analyses
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- Trigger to update updated_at
DROP TRIGGER IF EXISTS update_analyses_updated_at ON analyses;
CREATE TRIGGER update_analyses_updated_at
    BEFORE UPDATE ON analyses
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add table and column comments
COMMENT ON TABLE analyses IS 'AI skin analysis results and reports';
COMMENT ON COLUMN analyses.condition_name IS 'Detected skin condition name';
COMMENT ON COLUMN analyses.report_data IS 'Complete AI analysis report in JSON format';
COMMENT ON COLUMN analyses.image_url IS 'URL to the analyzed skin image';

-- =====================================================
-- Migration Complete
-- =====================================================
