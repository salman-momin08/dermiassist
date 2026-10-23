-- 35_fulltext_search_bm25.sql
--
-- Closes the "fake BM25" gap: ai_service/services/hybrid_search.py previously
-- computed a raw keyword-overlap bonus on top of the vector-ranked list, not a
-- genuinely independent second ranking. This migration adds a real Postgres
-- full-text search index and ranking function so the Python service can fuse
-- two *actually independent* ranked lists with real Reciprocal Rank Fusion.

ALTER TABLE medical_knowledge_chunks
  ADD COLUMN IF NOT EXISTS content_tsv tsvector
  GENERATED ALWAYS AS (
    to_tsvector('english', coalesce(title, '') || ' ' || coalesce(content, ''))
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_medical_knowledge_tsv
  ON medical_knowledge_chunks USING GIN (content_tsv);

-- Returns a genuinely independent keyword-ranked list (Postgres's built-in
-- ts_rank_cd full-text ranking, the standard non-extension equivalent of a
-- BM25-style score) with an explicit rank_position column, so the caller can
-- fuse it against the vector list's own rank_position using real RRF:
--   score(d) = 1/(60 + rank_bm25(d)) + 1/(60 + rank_vector(d))
-- instead of the old "keyword overlap bonus added to the vector score" hack.
CREATE OR REPLACE FUNCTION search_bm25_medical_knowledge(
  query_text text,
  match_count int,
  category_filter text DEFAULT NULL
) RETURNS TABLE (
  id UUID,
  title TEXT,
  condition_category TEXT,
  content TEXT,
  source TEXT,
  icd_code TEXT,
  rank_position INT,
  ts_rank REAL
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    mkc.id, mkc.title, mkc.condition_category, mkc.content, mkc.source, mkc.icd_code,
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

-- Public reference literature, same posture as match_medical_knowledge's own
-- policy: no restriction needed, there's no patient data in this table.
GRANT EXECUTE ON FUNCTION search_bm25_medical_knowledge(text, int, text) TO anon, authenticated, service_role;
