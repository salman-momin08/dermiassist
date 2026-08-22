/**
 * @fileOverview Clinician Review Lifecycle & Override Types.
 * Formalizes FDA SaMD (21 CFR 878.1830) compliance gate for DermiAssist-AI.
 */

export type ReviewStatus = 'pending_review' | 'in_review' | 'released' | 'rejected';

export interface ClinicianOverrides {
  conditionName?: string;
  condition?: string;
  recommendations?: string;
  dos?: string[];
  donts?: string[];
  icd10Code?: string;
  severity?: string;
  otherConsiderations?: string;
  biopsyOrdered?: boolean;
}

export interface ReviewableAnalysis {
  id: string;
  patient_id?: string;
  patient_name?: string;
  patient_age?: number;
  condition_name: string;
  confidence_score?: number;
  image_url?: string;
  proforma_answers?: Record<string, string> | any;
  recommendations?: string;
  dos?: string[];
  donts?: string[];
  other_considerations?: string;
  review_status: ReviewStatus;
  reviewer_id?: string;
  reviewer_name?: string;
  reviewer_badge_number?: string;
  reviewer_notes?: string;
  clinician_overrides?: ClinicianOverrides;
  reviewed_at?: string;
  created_at: string;
}
