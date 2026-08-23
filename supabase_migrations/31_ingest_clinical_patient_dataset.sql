-- ==============================================================================
-- DermiAssist-AI: RAG Knowledge Base Ingestion (NEUTRALIZED)
-- Migration: 31_ingest_clinical_patient_dataset.sql
-- ==============================================================================
--
-- This migration previously INSERTed hand-written "Empirical Clinical Cohort /
-- DermiAssist Clinical Registry (N=500 Multi-Center Cohort)" rows containing
-- fabricated statistics (mean severity scores, family-history percentages,
-- patient counts) under a non-existent registry citation. That is fabricated
-- medical evidence and has been removed for patient safety.
--
-- It also targeted a table named `medical_knowledge`, which does not exist — the
-- real table is `medical_knowledge_chunks` (see 20_vector_embeddings_rag.sql).
-- Even had it run, the rows would have had a NULL `embedding`, so they could
-- never be returned by the vector search RPC.
--
-- RAG grounding is now populated by a REAL pipeline that generates genuine
-- Gemini text-embedding-004 vectors for a curated, attributable knowledge base:
--
--     src/ai/rag/datasets/dermatology-knowledge-base.json   (curated, sourced content)
--     ai_service/ingestion/ingest_knowledge_base.py         (embed + upsert)
--
-- Run:  python -m ai_service.ingestion.ingest_knowledge_base
--
-- This migration is intentionally a no-op.

DO $$
BEGIN
  RAISE NOTICE 'Migration 31 is a no-op. Populate medical_knowledge_chunks via ai_service/ingestion/ingest_knowledge_base.py (real embeddings).';
END $$;
