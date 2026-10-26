-- =====================================================
-- 00 · Extensions & shared helpers
-- =====================================================
-- Consolidated canonical schema for DermiAssist (fresh-install DDL).
--
-- Run the files in THIS folder in numeric order (00 -> 10) on a NEW / empty
-- Supabase database. Do NOT run these against the existing production database
-- that already applied the incremental migrations 01-37 — they are the
-- single-source-of-truth rewrite of those migrations, not a replay.
--
-- Run order & why:
--   00_extensions_and_shared    extensions + update_updated_at_column()
--   01_profiles                 profiles + is_admin()/helpers (everything depends on this)
--   02_appointments             created before analyses (analyses doctor-policies reference it)
--   03_connection_requests      created before doctor_cases (its create-policy references it)
--   04_analyses                 partitioned analyses + composite FK back onto appointments
--   05_doctor_cases             FK to analyses + appointments + connection_requests
--   06_contact_requests
--   07_doctor_reviews
--   08_medical_knowledge_chunks RAG vector search + BM25 full-text search
--   09_patient_history          audit history (triggers on appointments/doctor_cases/analyses)
--   10_storage                  verification-docs storage bucket
-- =====================================================

-- pgvector for RAG embedding search (used by 08_medical_knowledge_chunks).
CREATE EXTENSION IF NOT EXISTS vector;

-- Shared trigger function: set updated_at = NOW() on every row update.
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
