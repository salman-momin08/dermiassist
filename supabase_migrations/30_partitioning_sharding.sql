-- =====================================================
-- Database Partitioning & Sharding Strategy Migration
-- =====================================================
-- Implements Range Partitioning by date for high-volume analyses logs,
-- optimizing B-Tree index scan performance at scale (>1,000,000 records).

-- 1. Create Partitioned Parent Table for Analyses Telemetry
CREATE TABLE IF NOT EXISTS analyses_partitioned (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    condition_name TEXT NOT NULL,
    severity TEXT NOT NULL,
    confidence_score NUMERIC NOT NULL,
    image_url TEXT,
    report_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- 2. Create Monthly Partitions for Current & Future Periods
CREATE TABLE IF NOT EXISTS analyses_y2026_q1 PARTITION OF analyses_partitioned
    FOR VALUES FROM ('2026-01-01 00:00:00+00') TO ('2026-04-01 00:00:00+00');

CREATE TABLE IF NOT EXISTS analyses_y2026_q2 PARTITION OF analyses_partitioned
    FOR VALUES FROM ('2026-04-01 00:00:00+00') TO ('2026-07-01 00:00:00+00');

CREATE TABLE IF NOT EXISTS analyses_y2026_q3 PARTITION OF analyses_partitioned
    FOR VALUES FROM ('2026-07-01 00:00:00+00') TO ('2026-10-01 00:00:00+00');

CREATE TABLE IF NOT EXISTS analyses_y2026_q4 PARTITION OF analyses_partitioned
    FOR VALUES FROM ('2026-10-01 00:00:00+00') TO ('2027-01-01 00:00:00+00');

-- Default Partition for catch-all records
CREATE TABLE IF NOT EXISTS analyses_default PARTITION OF analyses_partitioned DEFAULT;

-- 3. Create Local Partitioned Indexes
CREATE INDEX IF NOT EXISTS idx_analyses_part_user_date 
ON analyses_partitioned (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_analyses_part_condition 
ON analyses_partitioned (condition_name);
