-- =====================================================
-- Vector Embeddings & RAG Knowledge Base Migration
-- =====================================================
-- Enables pgvector extension and creates medical_knowledge_chunks table
-- with vector search functions for RAG retrieval.

-- 1. Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Create medical_knowledge_chunks table
CREATE TABLE IF NOT EXISTS medical_knowledge_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    condition_category TEXT NOT NULL,
    content TEXT NOT NULL,
    source TEXT NOT NULL,
    icd_code TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    embedding vector(768), -- 768 dimensions for Gemini text-embedding-004
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Create index for fast vector cosine distance search
CREATE INDEX IF NOT EXISTS idx_medical_knowledge_embedding 
ON medical_knowledge_chunks 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

CREATE INDEX IF NOT EXISTS idx_medical_knowledge_category 
ON medical_knowledge_chunks (condition_category);

-- 4. Enable RLS on medical_knowledge_chunks
ALTER TABLE medical_knowledge_chunks ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if present
DROP POLICY IF EXISTS "Allow authenticated read on medical knowledge" ON medical_knowledge_chunks;
DROP POLICY IF EXISTS "Allow public read on medical knowledge" ON medical_knowledge_chunks;

-- Allow read access for medical retrieval
CREATE POLICY "Allow public read on medical knowledge" ON medical_knowledge_chunks
    FOR SELECT
    USING (true);

-- 5. Stored Procedure for Hybrid Vector Similarity Search
CREATE OR REPLACE FUNCTION match_medical_knowledge (
  query_embedding vector(768),
  match_threshold float,
  match_count int,
  category_filter text DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  condition_category TEXT,
  content TEXT,
  source TEXT,
  icd_code TEXT,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    mkc.id,
    mkc.title,
    mkc.condition_category,
    mkc.content,
    mkc.source,
    mkc.icd_code,
    1 - (mkc.embedding <=> query_embedding) AS similarity
  FROM medical_knowledge_chunks mkc
  WHERE (category_filter IS NULL OR mkc.condition_category = category_filter)
    AND 1 - (mkc.embedding <=> query_embedding) > match_threshold
  ORDER BY mkc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
