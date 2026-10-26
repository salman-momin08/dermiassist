-- =====================================================
-- 09 · patient history audit  (versions + access log + RPC)
-- =====================================================
-- Reconciles: 37_patient_history.
-- Depends on: 00, 01 (profiles), 02 (appointments), 04 (analyses), 05 (doctor_cases),
--             03 (connection_requests — used by the access-control check).
-- The one-time BACKFILL SELECTs from the original migration are intentionally
-- omitted here (fresh install has no rows to archive).

-- Append-only version history of every patient-facing record.
CREATE TABLE public.patient_record_versions (
    version_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    patient_id UUID NOT NULL,
    patient_name TEXT NOT NULL,
    record_kind TEXT NOT NULL CHECK (record_kind IN ('consultation', 'case', 'analysis')),
    record_id UUID NOT NULL,
    occurred_at TIMESTAMPTZ NOT NULL,
    captured_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    operation TEXT NOT NULL,
    entry JSONB NOT NULL
);

CREATE INDEX patient_record_versions_patient_idx
    ON public.patient_record_versions (patient_id, record_kind, record_id, version_id DESC);

ALTER TABLE public.patient_record_versions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.patient_record_versions FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE public.patient_record_versions_version_id_seq FROM PUBLIC, anon, authenticated;

-- Audit log of who read a patient's history.
CREATE TABLE public.patient_history_access_log (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    actor_id UUID NOT NULL,
    actor_role TEXT NOT NULL,
    patient_id UUID NOT NULL,
    accessed_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    page_number INTEGER NOT NULL,
    records_returned INTEGER NOT NULL
);

CREATE INDEX patient_history_access_log_patient_idx
    ON public.patient_history_access_log (patient_id, accessed_at DESC);

ALTER TABLE public.patient_history_access_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.patient_history_access_log FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE public.patient_history_access_log_id_seq FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.patient_history_access_log TO authenticated;
CREATE POLICY "Admins can inspect history access logs"
    ON public.patient_history_access_log FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- Normalizes a consultation/case/analysis row into a patient-history entry.
CREATE FUNCTION public.archive_patient_record(record_kind TEXT, source_record JSONB, operation TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    patient_uuid UUID;
    doctor_uuid UUID;
    patient_name TEXT;
    doctor_profile JSONB;
    record_details JSONB;
    record_time TIMESTAMPTZ;
    record_title TEXT;
    record_status TEXT;
BEGIN
    patient_uuid := COALESCE(source_record->>'patient_id', source_record->>'user_id')::UUID;
    doctor_uuid := COALESCE(source_record->>'doctor_id', source_record->>'reviewer_id')::UUID;
    SELECT COALESCE(display_name, 'Patient') INTO patient_name
        FROM public.profiles WHERE id = patient_uuid;
    SELECT jsonb_build_object(
        'id', id, 'name', COALESCE(display_name, 'Doctor'),
        'specialization', to_jsonb(profiles)->>'specialization',
        'photoUrl', to_jsonb(profiles)->>'photo_url'
    ) INTO doctor_profile FROM public.profiles WHERE id = doctor_uuid;
    record_time := COALESCE(
        NULLIF(source_record->>'appointment_date', '')::TIMESTAMPTZ,
        NULLIF(source_record->>'date', '')::TIMESTAMPTZ,
        NULLIF(source_record->>'preferred_date', '')::TIMESTAMPTZ,
        NULLIF(source_record->>'last_appointment_date', '')::TIMESTAMPTZ,
        NULLIF(source_record->>'created_at', '')::TIMESTAMPTZ,
        now()
    );

    IF record_kind = 'consultation' THEN
        record_title := 'Consultation';
        record_status := COALESCE(source_record->>'status', 'unknown');
        record_details := jsonb_build_object(
            'Time', COALESCE(source_record->'time', source_record->'preferred_time'),
            'Mode', COALESCE(source_record->'appointment_mode', source_record->'type'),
            'Notes', source_record->'notes', 'Patient notes', source_record->'patient_notes',
            'Doctor notes', source_record->'doctor_notes',
            'Reason for visit', source_record->'reason_for_visit',
            'Symptoms duration', source_record->'symptoms_duration',
            'Symptoms severity', source_record->'symptoms_severity',
            'Past treatments', source_record->'past_treatments',
            'Current medications', source_record->'current_medications',
            'Allergies', source_record->'allergies', 'Prescription', source_record->'prescription',
            'Attached report', source_record->'attached_report_summary',
            'Attached report reference', source_record->'attached_report_id',
            'Image references', source_record->'uploaded_image_urls',
            'Document references', source_record->'uploaded_report_urls',
            'Emergency flag', source_record->'is_emergency', 'Data consent', source_record->'consent_data'
        );
    ELSIF record_kind = 'case' THEN
        record_title := COALESCE(NULLIF(source_record->>'diagnosis', ''), 'Clinical case');
        record_status := COALESCE(source_record->>'status', 'unknown');
        record_details := jsonb_build_object(
            'Diagnosis', source_record->'diagnosis', 'Symptoms', source_record->'symptoms',
            'Treatment plan', source_record->'treatment_plan', 'Prescription', source_record->'prescription',
            'Notes', source_record->'notes', 'Follow-up date', source_record->'follow_up_date',
            'Follow-up notes', source_record->'follow_up_notes',
            'Appointment reference', source_record->'appointment_id'
        );
    ELSIF record_kind = 'analysis' THEN
        record_title := COALESCE(
            NULLIF(source_record->'clinician_overrides'->>'conditionName', ''),
            source_record->>'condition_name', 'Skin analysis'
        );
        record_status := COALESCE(source_record->>'review_status', 'pending_review');
        record_details := jsonb_build_object(
            'Severity', source_record->'severity', 'Description', source_record->'condition_description',
            'Recommendations', source_record->'recommendations',
            'Report', source_record->'report_data', 'Submitted information', source_record->'submitted_info',
            'Care steps', source_record->'dos', 'Things to avoid', source_record->'donts',
            'Clinician review', source_record->'clinician_overrides',
            'Reviewer notes', source_record->'reviewer_notes', 'Reviewed at', source_record->'reviewed_at',
            'ICD-10 code', source_record->'icd10_code',
            'Image reference', COALESCE(source_record->'image_url', source_record->'image'),
            'Verification signature', source_record->'verification_signature'
        );
    ELSE
        RAISE EXCEPTION 'Unsupported patient record kind';
    END IF;

    INSERT INTO public.patient_record_versions (
        patient_id, patient_name, record_kind, record_id, occurred_at, operation, entry
    ) VALUES (
        patient_uuid, COALESCE(patient_name, source_record->>'patient_name', source_record->>'user_name', 'Patient'),
        record_kind, (source_record->>'id')::UUID, record_time, operation,
        jsonb_build_object(
            'id', source_record->>'id', 'kind', record_kind, 'occurredAt', record_time,
            'title', record_title, 'status', record_status, 'doctor', doctor_profile,
            'details', COALESCE((
                SELECT jsonb_agg(jsonb_build_object(
                    'label', key,
                    'value', CASE WHEN jsonb_typeof(value) = 'string' THEN value #>> '{}'
                        ELSE jsonb_pretty(value) END
                ) ORDER BY key)
                FROM jsonb_each(jsonb_strip_nulls(record_details))
                WHERE value NOT IN ('""'::jsonb, '{}'::jsonb, '[]'::jsonb)
            ), '[]'::jsonb)
        )
    );
END;
$$;

REVOKE ALL ON FUNCTION public.archive_patient_record(TEXT, JSONB, TEXT) FROM PUBLIC, anon, authenticated;

-- AFTER-write trigger: snapshot a new version on every meaningful change.
CREATE FUNCTION public.capture_patient_record_version()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF TG_OP = 'UPDATE' AND to_jsonb(NEW) = to_jsonb(OLD) THEN
        RETURN NEW;
    END IF;
    IF TG_OP = 'DELETE' THEN
        PERFORM public.archive_patient_record(TG_ARGV[0], to_jsonb(OLD), TG_OP);
        RETURN OLD;
    END IF;
    PERFORM public.archive_patient_record(TG_ARGV[0], to_jsonb(NEW), TG_OP);
    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.capture_patient_record_version() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER archive_appointment_history AFTER INSERT OR UPDATE OR DELETE ON public.appointments
    FOR EACH ROW EXECUTE FUNCTION public.capture_patient_record_version('consultation');
CREATE TRIGGER archive_case_history AFTER INSERT OR UPDATE OR DELETE ON public.doctor_cases
    FOR EACH ROW EXECUTE FUNCTION public.capture_patient_record_version('case');
CREATE TRIGGER archive_analysis_history AFTER INSERT OR UPDATE OR DELETE ON public.analyses
    FOR EACH ROW EXECUTE FUNCTION public.capture_patient_record_version('analysis');

-- Access-controlled, paginated history reader (self / admin / related verified doctor).
CREATE FUNCTION public.get_patient_history(target_patient_id UUID, page_number INTEGER DEFAULT 0)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    actor_uuid UUID := auth.uid();
    actor_role TEXT;
    actor_verified BOOLEAN;
    patient_name TEXT;
    result_entries JSONB;
    more_records BOOLEAN;
BEGIN
    IF actor_uuid IS NULL THEN
        RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
    END IF;
    IF target_patient_id IS NULL OR page_number IS NULL OR page_number < 0 OR page_number > 100000 THEN
        RAISE EXCEPTION 'Invalid history request' USING ERRCODE = '22023';
    END IF;
    SELECT role, verified INTO actor_role, actor_verified FROM public.profiles WHERE id = actor_uuid;
    IF NOT COALESCE(
        actor_uuid = target_patient_id
        OR actor_role = 'admin'
        OR (actor_role = 'doctor' AND actor_verified AND (
            EXISTS (SELECT 1 FROM public.appointments
                WHERE patient_id = target_patient_id AND doctor_id = actor_uuid
                AND lower(status) IN ('confirmed', 'completed'))
            OR EXISTS (SELECT 1 FROM public.connection_requests
                WHERE patient_id = target_patient_id AND doctor_id = actor_uuid AND lower(status) = 'accepted')
        )), false
    ) THEN
        RAISE EXCEPTION 'Patient history access denied' USING ERRCODE = '42501';
    END IF;

    SELECT display_name INTO patient_name FROM public.profiles WHERE id = target_patient_id AND role = 'patient';
    IF NOT FOUND THEN
        SELECT versions.patient_name INTO patient_name FROM public.patient_record_versions versions
            WHERE versions.patient_id = target_patient_id ORDER BY version_id DESC LIMIT 1;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Patient history unavailable' USING ERRCODE = '42501';
        END IF;
    END IF;

    WITH latest AS (
        SELECT DISTINCT ON (record_kind, record_id) record_kind, record_id, occurred_at, entry
        FROM public.patient_record_versions WHERE patient_id = target_patient_id
        ORDER BY record_kind, record_id, version_id DESC
    ), page AS (
        SELECT * FROM latest ORDER BY occurred_at DESC, record_kind, record_id
        LIMIT 26 OFFSET (page_number * 25)
    ), visible AS (
        SELECT * FROM page ORDER BY occurred_at DESC, record_kind, record_id LIMIT 25
    )
    SELECT COALESCE((SELECT jsonb_agg(entry ORDER BY occurred_at DESC, record_kind, record_id) FROM visible), '[]'::jsonb),
        (SELECT count(*) > 25 FROM page)
    INTO result_entries, more_records;

    INSERT INTO public.patient_history_access_log (actor_id, actor_role, patient_id, page_number, records_returned)
        VALUES (actor_uuid, COALESCE(actor_role, 'unknown'), target_patient_id, page_number, jsonb_array_length(result_entries));

    RETURN jsonb_build_object(
        'patient', jsonb_build_object('id', target_patient_id, 'name', COALESCE(patient_name, 'Patient')),
        'entries', result_entries, 'hasMore', more_records
    );
END;
$$;

REVOKE ALL ON FUNCTION public.get_patient_history(UUID, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_patient_history(UUID, INTEGER) TO authenticated;
