/**
 * @fileOverview UV Index & Skin Photoprotection Risk Engine.
 * Provides real-time solar UV index calculation, safe sun exposure times,
 * and tailored photoprotection guidelines based on Fitzpatrick Skin Phototypes.
 */

export type FitzpatrickSkinType = 'type1' | 'type2' | 'type3' | 'type4' | 'type5' | 'type6';

export interface SkinTypeProfile {
  id: FitzpatrickSkinType;
  name: string;
  description: string;
  burnTendency: string;
  tanTendency: string;
  baselineMinBurnMinutes: number; // Base minutes to erythema at UV 10
}

export const FITZPATRICK_PROFILES: Record<FitzpatrickSkinType, SkinTypeProfile> = {
  type1: {
    id: 'type1',
    name: 'Type I (Very Fair)',
    description: 'Pale white, freckles, red/blonde hair',
    burnTendency: 'Always burns easily',
    tanTendency: 'Never tans',
    baselineMinBurnMinutes: 10,
  },
  type2: {
    id: 'type2',
    name: 'Type II (Fair)',
    description: 'Fair skin, blue/hazel eyes, light hair',
    burnTendency: 'Burns easily',
    tanTendency: 'Tans minimally with difficulty',
    baselineMinBurnMinutes: 15,
  },
  type3: {
    id: 'type3',
    name: 'Type III (Medium Fair)',
    description: 'Medium white, dark blonde/brown hair',
    burnTendency: 'Burns moderately',
    tanTendency: 'Tans gradually to light brown',
    baselineMinBurnMinutes: 20,
  },
  type4: {
    id: 'type4',
    name: 'Type IV (Olive / Mediterranean)',
    description: 'Olive/light brown skin, dark hair',
    burnTendency: 'Burns minimally',
    tanTendency: 'Tans easily to moderate brown',
    baselineMinBurnMinutes: 30,
  },
  type5: {
    id: 'type5',
    name: 'Type V (Brown / Asian / Indian)',
    description: 'Brown skin, dark eyes/hair',
    burnTendency: 'Rarely burns',
    tanTendency: 'Tans profusely to dark brown',
    baselineMinBurnMinutes: 45,
  },
  type6: {
    id: 'type6',
    name: 'Type VI (Black / Dark Brown)',
    description: 'Deeply pigmented dark skin',
    burnTendency: 'Never burns',
    tanTendency: 'Deeply pigmented natural melanin protection',
    baselineMinBurnMinutes: 60,
  },
};

export interface UVProtectionAdvice {
  uvIndex: number;
  riskCategory: 'Low' | 'Moderate' | 'High' | 'Very High' | 'Extreme';
  colorCode: string;
  safeMinutesWithoutSunscreen: number;
  safeMinutesWithSPF50: number;
  recommendedSPF: 'SPF 15+' | 'SPF 30+' | 'SPF 50+ Broad Spectrum';
  reapplicationHours: number;
  protectiveMeasures: string[];
  clinicalNote: string;
}

/**
 * Calculate personalized solar UV photoprotection recommendations.
 */
export function calculateUVProtection(
  uvIndex: number = 6,
  skinType: FitzpatrickSkinType = 'type3',
  isSkinConditionActive: boolean = true
): UVProtectionAdvice {
  const profile = FITZPATRICK_PROFILES[skinType] || FITZPATRICK_PROFILES.type3;
  const safeUv = Math.max(1, Math.min(15, uvIndex));

  // Calculate safe unburned exposure time (Burn Minutes ~ (baseline * 10) / UV)
  let safeMinutes = Math.round((profile.baselineMinBurnMinutes * 10) / safeUv);
  if (isSkinConditionActive) {
    // Photosensitive / inflamed skin has 30% reduced UV threshold
    safeMinutes = Math.max(5, Math.round(safeMinutes * 0.7));
  }

  const safeWithSPF = Math.min(240, safeMinutes * 25);

  let riskCategory: UVProtectionAdvice['riskCategory'] = 'Moderate';
  let colorCode = '#eab308'; // yellow
  let recommendedSPF: UVProtectionAdvice['recommendedSPF'] = 'SPF 30+';
  let reapplicationHours = 2;
  const protectiveMeasures: string[] = [];

  if (safeUv <= 2) {
    riskCategory = 'Low';
    colorCode = '#10b981'; // green
    recommendedSPF = 'SPF 15+';
    protectiveMeasures.push(
      'Minimal danger for the average person.',
      'Wear sunglasses on bright days.',
      'Apply light moisturizer with SPF if outdoors for extended periods.'
    );
  } else if (safeUv <= 5) {
    riskCategory = 'Moderate';
    colorCode = '#eab308'; // yellow
    recommendedSPF = 'SPF 30+';
    protectiveMeasures.push(
      'Stay in the shade during midday solar peaks (11 AM - 3 PM).',
      'Wear protective clothing and UV-blocking sunglasses.',
      'Apply broad-spectrum SPF 30+ to exposed cutaneous areas.'
    );
  } else if (safeUv <= 7) {
    riskCategory = 'High';
    colorCode = '#f97316'; // orange
    recommendedSPF = 'SPF 50+ Broad Spectrum';
    protectiveMeasures.push(
      'Protection against skin damage is essential.',
      'Reduce exposure between 10 AM and 4 PM.',
      'Wear a wide-brimmed hat, sunglasses, and UV-absorbing clothing.',
      'Reapply broad-spectrum sunscreen every 2 hours.'
    );
  } else if (safeUv <= 10) {
    riskCategory = 'Very High';
    colorCode = '#ef4444'; // red
    recommendedSPF = 'SPF 50+ Broad Spectrum';
    protectiveMeasures.push(
      'Unprotected skin can burn rapidly.',
      'Seek shade and avoid direct midday solar radiation.',
      'Liberally apply mineral Zinc Oxide or Titanium Dioxide SPF 50+.'
    );
  } else {
    riskCategory = 'Extreme';
    colorCode = '#8b5cf6'; // purple
    recommendedSPF = 'SPF 50+ Broad Spectrum';
    protectiveMeasures.push(
      'Take all precautions; unprotected skin burns in minutes.',
      'Avoid sun exposure between 10 AM and 4 PM.',
      'Wear full coverage UV protective garments and broad-spectrum SPF 50+.'
    );
  }

  const clinicalNote = isSkinConditionActive
    ? 'Active dermatological lesions and healing skin have compromised epidermal barriers, increasing post-inflammatory hyperpigmentation (PIH) and erythema risk. Strict photoprotection is strongly advised.'
    : 'Routine maintenance photoprotection reduces photoaging, photo-carcinogenesis, and actinic keratosis formation.';

  return {
    uvIndex: safeUv,
    riskCategory,
    colorCode,
    safeMinutesWithoutSunscreen: safeMinutes,
    safeMinutesWithSPF50: safeWithSPF,
    recommendedSPF,
    reapplicationHours,
    protectiveMeasures,
    clinicalNote,
  };
}
