/**
 * @fileOverview HL7 FHIR (Fast Healthcare Interoperability Resources) R4 Exporter.
 * Generates standards-compliant FHIR R4 Bundles (DiagnosticReport, Condition, Observation, Patient)
 * for seamless interoperability with hospital EMR/EHR systems (Epic, Cerner, Allscripts).
 */

export interface FhirExportOptions {
  patientId?: string;
  patientName?: string;
  patientGender?: 'male' | 'female' | 'other' | 'unknown';
  patientBirthDate?: string;
  conditionName: string;
  icd10Code?: string;
  snomedCode?: string;
  severity?: 'Mild' | 'Moderate' | 'Severe';
  summary?: string;
  dos?: string[];
  donts?: string[];
  recommendations?: string;
  otherConsiderations?: string;
  photoUrlOrDataUri?: string;
  recordedDate?: string;
  evaluatingClinician?: string;
}

/**
 * Maps common dermatological condition names to standard ICD-10 and SNOMED-CT codes.
 */
export function getMedicalCoding(conditionName: string): { icd10: string; snomed: string; display: string } {
  const norm = conditionName.toLowerCase();
  
  if (norm.includes('psoriasis')) {
    return { icd10: 'L40.0', snomed: '9014002', display: 'Psoriasis vulgaris' };
  } else if (norm.includes('eczema') || norm.includes('atopic dermatitis')) {
    return { icd10: 'L20.9', snomed: '24079001', display: 'Atopic dermatitis' };
  } else if (norm.includes('acne')) {
    return { icd10: 'L70.0', snomed: '247472004', display: 'Acne vulgaris' };
  } else if (norm.includes('rosacea')) {
    return { icd10: 'L71.9', snomed: '398909004', display: 'Rosacea' };
  } else if (norm.includes('melanoma')) {
    return { icd10: 'C43.9', snomed: '372244006', display: 'Malignant melanoma of skin' };
  } else if (norm.includes('seborrheic')) {
    return { icd10: 'L21.9', snomed: '59820001', display: 'Seborrheic dermatitis' };
  } else if (norm.includes('tinea') || norm.includes('fungal') || norm.includes('ringworm')) {
    return { icd10: 'B35.9', snomed: '276239002', display: 'Dermatophytosis (Tinea)' };
  } else if (norm.includes('contact dermatitis')) {
    return { icd10: 'L25.9', snomed: '40275004', display: 'Unspecified contact dermatitis' };
  } else if (norm.includes('urticaria') || norm.includes('hives')) {
    return { icd10: 'L50.9', snomed: '126485001', display: 'Urticaria' };
  } else if (norm.includes('vitiligo')) {
    return { icd10: 'L80', snomed: '56727007', display: 'Vitiligo' };
  }

  return { icd10: 'L98.9', snomed: '106076001', display: conditionName };
}

/**
 * Generate a complete, compliant HL7 FHIR R4 Bundle JSON document.
 */
export function generateFhirR4Bundle(options: FhirExportOptions): Record<string, any> {
  const timestamp = options.recordedDate || new Date().toISOString();
  const bundleId = `dermiassist-bundle-${Date.now()}`;
  const patientId = options.patientId || `pat-${Math.random().toString(36).substring(2, 9)}`;
  const conditionId = `cond-${Math.random().toString(36).substring(2, 9)}`;
  const observationId = `obs-${Math.random().toString(36).substring(2, 9)}`;
  const reportId = `diagrep-${Math.random().toString(36).substring(2, 9)}`;

  const coding = getMedicalCoding(options.conditionName);
  const icdCode = options.icd10Code || coding.icd10;
  const snomedCode = options.snomedCode || coding.snomed;

  // 1. Patient Resource
  const patientResource = {
    resourceType: 'Patient',
    id: patientId,
    meta: {
      profile: ['http://hl7.org/fhir/StructureDefinition/Patient'],
    },
    active: true,
    name: [
      {
        use: 'official',
        text: options.patientName || 'Anonymous Patient',
      },
    ],
    gender: options.patientGender || 'unknown',
    birthDate: options.patientBirthDate || undefined,
  };

  // 2. Condition Resource
  const conditionResource = {
    resourceType: 'Condition',
    id: conditionId,
    meta: {
      profile: ['http://hl7.org/fhir/StructureDefinition/Condition'],
    },
    clinicalStatus: {
      coding: [
        {
          system: 'http://terminology.hl7.org/CodeSystem/condition-clinical',
          code: 'active',
          display: 'Active',
        },
      ],
    },
    verificationStatus: {
      coding: [
        {
          system: 'http://terminology.hl7.org/CodeSystem/condition-ver-status',
          code: 'provisional',
          display: 'Provisional Clinical Triage',
        },
      ],
    },
    category: [
      {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/condition-category',
            code: 'encounter-diagnosis',
            display: 'Encounter Diagnosis',
          },
        ],
      },
    ],
    severity: options.severity
      ? {
          coding: [
            {
              system: 'http://snomed.info/sct',
              code: options.severity === 'Severe' ? '24484000' : options.severity === 'Moderate' ? '6736007' : '255604002',
              display: options.severity,
            },
          ],
        }
      : undefined,
    code: {
      coding: [
        {
          system: 'http://hl7.org/fhir/sid/icd-10',
          code: icdCode,
          display: coding.display,
        },
        {
          system: 'http://snomed.info/sct',
          code: snomedCode,
          display: coding.display,
        },
      ],
      text: options.conditionName,
    },
    subject: {
      reference: `Patient/${patientId}`,
      display: options.patientName || 'Anonymous Patient',
    },
    recordedDate: timestamp,
    note: options.summary ? [{ text: options.summary }] : undefined,
  };

  // 3. Observation Resource (Lesion Morphology & Clinical Finding)
  const observationResource = {
    resourceType: 'Observation',
    id: observationId,
    meta: {
      profile: ['http://hl7.org/fhir/StructureDefinition/Observation'],
    },
    status: 'final',
    category: [
      {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/observation-category',
            code: 'exam',
            display: 'Physical Examination',
          },
        ],
      },
    ],
    code: {
      coding: [
        {
          system: 'http://snomed.info/sct',
          code: '400010009',
          display: 'Skin lesion finding',
        },
      ],
      text: 'Cutaneous Lesion Visual Examination',
    },
    subject: {
      reference: `Patient/${patientId}`,
    },
    effectiveDateTime: timestamp,
    valueString: options.summary || `Cutaneous manifestation characteristic of ${options.conditionName}.`,
    interpretation: [
      {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation',
            code: options.severity === 'Severe' ? 'A' : 'N',
            display: options.severity === 'Severe' ? 'Abnormal (Alert)' : 'Normal finding',
          },
        ],
      },
    ],
  };

  // 4. DiagnosticReport Resource (Master Assessment Report)
  const diagnosticReportResource: Record<string, any> = {
    resourceType: 'DiagnosticReport',
    id: reportId,
    meta: {
      profile: ['http://hl7.org/fhir/StructureDefinition/DiagnosticReport'],
    },
    identifier: [
      {
        system: 'https://dermiassist.ai/reports',
        value: reportId,
      },
    ],
    status: 'final',
    category: [
      {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/v2-0074',
            code: 'RAD',
            display: 'Dermatological Imaging & Clinical Triage',
          },
        ],
      },
    ],
    code: {
      coding: [
        {
          system: 'http://loinc.org',
          code: '72170-4',
          display: 'Photographic image of skin lesion',
        },
      ],
      text: 'AI-Assisted Dermatological Clinical Assessment',
    },
    subject: {
      reference: `Patient/${patientId}`,
      display: options.patientName || 'Anonymous Patient',
    },
    effectiveDateTime: timestamp,
    issued: timestamp,
    performer: [
      {
        display: options.evaluatingClinician || 'DermiAssist-AI Multi-Agent Diagnostic Engine (v2.0)',
      },
    ],
    result: [
      {
        reference: `Observation/${observationId}`,
      },
    ],
    conclusion: `${options.conditionName} (ICD-10: ${icdCode}). ${options.recommendations || ''}`,
    conclusionCode: [
      {
        coding: [
          {
            system: 'http://hl7.org/fhir/sid/icd-10',
            code: icdCode,
            display: coding.display,
          },
        ],
      },
    ],
  };

  // Attach presented photo if provided
  if (options.photoUrlOrDataUri) {
    diagnosticReportResource.presentedForm = [
      {
        contentType: 'image/jpeg',
        url: options.photoUrlOrDataUri.startsWith('http') ? options.photoUrlOrDataUri : undefined,
        data: options.photoUrlOrDataUri.startsWith('data:') ? options.photoUrlOrDataUri.split(',')[1] : undefined,
        title: 'Primary Cutaneous Specimen Photo',
      },
    ];
  }

  // Master Document Bundle
  return {
    resourceType: 'Bundle',
    id: bundleId,
    meta: {
      lastUpdated: timestamp,
      profile: ['http://hl7.org/fhir/StructureDefinition/Bundle'],
    },
    type: 'document',
    timestamp: timestamp,
    entry: [
      { fullUrl: `urn:uuid:${patientId}`, resource: patientResource },
      { fullUrl: `urn:uuid:${conditionId}`, resource: conditionResource },
      { fullUrl: `urn:uuid:${observationId}`, resource: observationResource },
      { fullUrl: `urn:uuid:${reportId}`, resource: diagnosticReportResource },
    ],
  };
}

/**
 * Triggers instant client-side download of the HL7 FHIR R4 Bundle JSON.
 */
export function downloadFhirJson(options: FhirExportOptions, filename?: string): void {
  const bundle = generateFhirR4Bundle(options);
  const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(bundle, null, 2))}`;
  const downloadAnchor = document.createElement('a');
  const safeCondition = (options.conditionName || 'assessment').replace(/[^a-z0-9]/gi, '_').toLowerCase();
  
  downloadAnchor.setAttribute('href', jsonString);
  downloadAnchor.setAttribute('download', filename || `DermiAssist_FHIR_R4_${safeCondition}_${Date.now()}.fhir.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}
