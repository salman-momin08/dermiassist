-- 36_add_report_verification.sql
--
-- Closes the "decorative QR verification" gap: src/app/verify-report/[id]/page.tsx
-- previously rendered "Cryptographically Verified" / "SHA-256 Signature Valid"
-- unconditionally for ANY id typed into the URL, with no database lookup at all.
--
-- Design: the HMAC secret (REPORT_SIGNING_SECRET) stays in Node's environment
-- only -- it is never stored in or computed by Postgres. This function's job is
-- solely to return the non-sensitive summary fields plus the *stored* signature,
-- anonymously (the verification page is public/unauthenticated), without
-- exposing the full report/patient PII that normal RLS would otherwise block an
-- anonymous caller from ever seeing anyway. The actual HMAC recomputation and
-- comparison happens in the Next.js server component
-- (src/app/verify-report/[id]/page.tsx), using crypto.timingSafeEqual.

ALTER TABLE analyses ADD COLUMN IF NOT EXISTS verification_signature TEXT;

DROP FUNCTION IF EXISTS get_report_verification_summary(uuid);
CREATE OR REPLACE FUNCTION get_report_verification_summary(p_analysis_id uuid, p_signature text)
RETURNS TABLE (
  found boolean,
  condition_name text,
  review_status text,
  reviewer_name text,
  reviewer_badge text,
  report_date timestamptz,
  reviewed_at timestamptz,
  stored_signature text
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT true, a.condition_name, a.review_status, a.reviewer_name, a.reviewer_badge,
         a.date, a.reviewed_at, a.verification_signature
  FROM analyses a
  WHERE a.id = p_analysis_id
    AND a.review_status = 'released'
    AND a.verification_signature = p_signature
    AND length(p_signature) = 64;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::text, NULL::text, NULL::text, NULL::text,
                        NULL::timestamptz, NULL::timestamptz, NULL::text;
  END IF;
END;
$$;

-- Callable anonymously -- this is the public report-verification page's whole
-- point -- but only ever returns the 8 non-sensitive columns above, never the
-- full report_data/image_url/user_id that normal RLS protects.
REVOKE ALL ON FUNCTION get_report_verification_summary(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_report_verification_summary(uuid, text) TO anon, authenticated;
