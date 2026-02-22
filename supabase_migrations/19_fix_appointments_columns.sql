-- Add missing columns to appointments table to support the appointment request flow
ALTER TABLE appointments 
ADD COLUMN IF NOT EXISTS preferred_date DATE,
ADD COLUMN IF NOT EXISTS preferred_time TEXT,
ADD COLUMN IF NOT EXISTS reason_for_visit TEXT,
ADD COLUMN IF NOT EXISTS symptoms_duration TEXT,
ADD COLUMN IF NOT EXISTS symptoms_severity TEXT,
ADD COLUMN IF NOT EXISTS past_treatments TEXT,
ADD COLUMN IF NOT EXISTS current_medications TEXT,
ADD COLUMN IF NOT EXISTS allergies TEXT,
ADD COLUMN IF NOT EXISTS is_emergency BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS consent_data BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS agree_terms BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS attached_report_id UUID REFERENCES analyses(id),
ADD COLUMN IF NOT EXISTS attached_report_summary JSONB,
ADD COLUMN IF NOT EXISTS uploaded_image_urls TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS uploaded_report_urls TEXT[] DEFAULT '{}';

-- Update the status check constraint to include 'Declined' and 'Confirmed' (with proper casing)
ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_status_check;

ALTER TABLE appointments 
ADD CONSTRAINT appointments_status_check 
CHECK (status IN ('Pending', 'Confirmed', 'Declined', 'Completed', 'Cancelled', 'pending', 'confirmed', 'completed', 'cancelled'));

-- Safely drop NOT NULL from date/time/type columns only if they exist
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='appointments' AND column_name='date') THEN
        ALTER TABLE appointments ALTER COLUMN date DROP NOT NULL;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='appointments' AND column_name='time') THEN
        ALTER TABLE appointments ALTER COLUMN time DROP NOT NULL;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='appointments' AND column_name='type') THEN
        ALTER TABLE appointments ALTER COLUMN type DROP NOT NULL;
    END IF;
END $$;
