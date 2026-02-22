-- Create doctor_reviews table
-- Linked to profiles (doctor and patient)
-- Includes rating (1-5), testimonial (kudos), and feedback


-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TABLE IF NOT EXISTS doctor_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    doctor_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    patient_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    kudos TEXT, -- Public testimonial
    feedback TEXT, -- Private feedback or additional comments
    is_public BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for querying reviews
CREATE INDEX IF NOT EXISTS idx_doctor_reviews_doctor_id ON doctor_reviews(doctor_id);
CREATE INDEX IF NOT EXISTS idx_doctor_reviews_rating ON doctor_reviews(rating);

-- RLS Policies
ALTER TABLE doctor_reviews ENABLE ROW LEVEL SECURITY;

-- Everyone can read public reviews
CREATE POLICY "Public reviews are viewable by everyone" 
    ON doctor_reviews FOR SELECT 
    USING (is_public = true);

-- Patients can create reviews
CREATE POLICY "Patients can create reviews" 
    ON doctor_reviews FOR INSERT 
    WITH CHECK (auth.uid() = patient_id);

-- Patients can update their own reviews
CREATE POLICY "Patients can update own reviews" 
    ON doctor_reviews FOR UPDATE 
    USING (auth.uid() = patient_id);

-- Doctors can view all reviews for them (including non-public if we decide to use that)
CREATE POLICY "Doctors can view reviews about themselves" 
    ON doctor_reviews FOR SELECT 
    USING (auth.uid() = doctor_id);
    
-- Add trigger for updated_at
CREATE TRIGGER update_doctor_reviews_updated_at
    BEFORE UPDATE ON doctor_reviews
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
