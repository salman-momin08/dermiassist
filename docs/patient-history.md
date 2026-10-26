# Patient History

Apply `supabase_migrations/37_patient_history.sql` after migrations 01 through 36 before deploying the history pages. The migration is transactional, backfills current appointments, doctor cases and analyses, and installs archival triggers. It does not recover records or earlier revisions deleted before installation. Review the backfill cost on production-sized databases and take a backup before applying it.

## Routes

- Patients: `/medical-history`, including their UUID and their own records.
- Doctors: `/doctor/patient-history`, with patient UUID lookup.
- Admins: `/admin/patient-history`, with patient UUID lookup.

All three routes are linked from desktop and mobile navigation. History includes consultation statuses, clinical case details, AI reports, clinician reviews and a doctor-reference dialog containing the recorded name, specialization, photo and UUID. This reference is a snapshot, not a claim about the doctor's current verification or availability. Records are paginated in groups of 25, newest first. The timeline displays the latest archived version of each source record, including source records deleted after installation.

## Access Rules

The `get_patient_history` database function derives the caller from `auth.uid()`. A supplied UUID never grants access on its own. Patients can read only their own history. Admins can read any patient's history, including archived records whose patient profile was deleted. A verified doctor needs either a confirmed/completed appointment with the patient or an accepted connection request. Once authorized, the doctor can see the patient's history across providers, not just their own cases. This relationship rule must be approved as the product's history-sharing policy; an accepted connection is not a substitute for any additional consent required by local law or clinic policy.

The RPC uses a fixed empty search path, schema-qualified tables, and an explicit authorization check before any clinical data is returned. It runs with definer privileges so authorized doctors can read historical entries across providers without broadening base-table RLS. Anonymous execution is revoked. The server action also authenticates and validates the UUID and page number. Database failures are surfaced rather than shown as an empty history.

## Archive and Audit

`patient_record_versions` stores an append-only snapshot of the selected clinical fields on source insert, update and delete. It deliberately has no cascading foreign keys to user profiles, so deleting a source record or user does not silently delete the archive. Browser roles cannot directly read or mutate this table or execute its capture helpers. Database owners can inspect all revisions by patient UUID and `version_id`; the application timeline is not a revision browser. The archive does not copy video channel tokens or authentication secrets.

Every successful history page read appends the authenticated actor UUID, current role, target UUID, time, page and returned count to `patient_history_access_log`. Admins can query this log through RLS; browser roles cannot write, update or delete it. Failed calls are not retained by this transactional audit log. Audit additional access paths independently: existing analysis, appointment and case screens do not pass through this RPC.

## Retention and Legal Review

These controls are not a legal-compliance certification or a tamper-proof external archive. Database owners and service credentials remain privileged. Current data is backfilled as it exists at installation; subsequent versions are captured, not cryptographically signed. Image references do not preserve image bytes if object storage is deleted. Backups, encryption, access monitoring, media retention, legal holds and independent audit storage need operational policies.

The new archive survives existing user-deletion cascades. Before production rollout, approve a jurisdiction-specific retention/deletion policy and update privacy notices and account-erasure workflows accordingly. No automatic archive purge or legal retention duration is imposed by this migration. An approved privileged process must handle lawful erasure, retention expiry and legal holds. Do not deploy this retention behavior for real patient data without that review.

## Verification

Run `node --test --test-name-pattern="patient history" tests/production-regressions.test.cjs` and `npm run typecheck`.

In a disposable Supabase database, apply the migration and test anonymous callers, a patient requesting another patient's UUID, unverified/unrelated doctors, pending/cancelled appointments, verified related doctors, accepted connections and admins. Test more than 25 records, source updates/deletes, account deletion, doctor-reference snapshots and access-log permissions. Never use real patient data for tests.