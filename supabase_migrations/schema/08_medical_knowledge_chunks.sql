-- =====================================================
-- 08 · medical_knowledge_chunks  (RAG vector + BM25 full-text)
-- =====================================================
-- Reconciles: 20_vector_embeddings_rag, 35_fulltext_search_bm25.
-- Depends on: 00 (vector extension).
-- Public reference literature — no patient data, so read access is open and the
-- search RPCs are granted to anon/authenticated/service_role.

CREATE TABLE IF NOT EXISTS medical_knowledge_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    condition_category TEXT NOT NULL,
    content TEXT NOT NULL,
    source TEXT NOT NULL,
    icd_code TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    embedding vector(768), -- 768 dims (Google text-embedding-004)
    content_tsv tsvector GENERATED ALWAYS AS (
        to_tsvector('english', coalesce(title, '') || ' ' || coalesce(content, ''))
    ) STORED,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_medical_knowledge_embedding
    ON medical_knowledge_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX IF NOT EXISTS idx_medical_knowledge_category
    ON medical_knowledge_chunks (condition_category);
CREATE INDEX IF NOT EXISTS idx_medical_knowledge_tsv
    ON medical_knowledge_chunks USING GIN (content_tsv);

ALTER TABLE medical_knowledge_chunks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read on medical knowledge" ON medical_knowledge_chunks
    FOR SELECT USING (TRUE);

-- ── Vector cosine-similarity search ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION match_medical_knowledge (
  query_embedding vector(768),
  match_threshold float,
  match_count int,
  category_filter text DEFAULT NULL
)
RETURNS TABLE (
  id UUID, title TEXT, condition_category TEXT, content TEXT, source TEXT, icd_code TEXT, similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT mkc.id, mkc.title, mkc.condition_category, mkc.content, mkc.source, mkc.icd_code,
    1 - (mkc.embedding <=> query_embedding) AS similarity
  FROM medical_knowledge_chunks mkc
  WHERE (category_filter IS NULL OR mkc.condition_category = category_filter)
    AND 1 - (mkc.embedding <=> query_embedding) > match_threshold
  ORDER BY mkc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- ── Independent keyword ranking (ts_rank_cd) for real RRF fusion ────────────
CREATE OR REPLACE FUNCTION search_bm25_medical_knowledge(
  query_text text,
  match_count int,
  category_filter text DEFAULT NULL
) RETURNS TABLE (
  id UUID, title TEXT, condition_category TEXT, content TEXT, source TEXT, icd_code TEXT,
  rank_position INT, ts_rank REAL
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT mkc.id, mkc.title, mkc.condition_category, mkc.content, mkc.source, mkc.icd_code,
    ROW_NUMBER() OVER (
      ORDER BY ts_rank_cd(mkc.content_tsv, plainto_tsquery('english', query_text)) DESC
    )::int AS rank_position,
    ts_rank_cd(mkc.content_tsv, plainto_tsquery('english', query_text)) AS ts_rank
  FROM medical_knowledge_chunks mkc
  WHERE (category_filter IS NULL OR mkc.condition_category = category_filter)
    AND mkc.content_tsv @@ plainto_tsquery('english', query_text)
  ORDER BY ts_rank_cd(mkc.content_tsv, plainto_tsquery('english', query_text)) DESC
  LIMIT match_count;
END;
$$;

GRANT EXECUTE ON FUNCTION match_medical_knowledge(vector, float, int, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION search_bm25_medical_knowledge(text, int, text) TO anon, authenticated, service_role;
