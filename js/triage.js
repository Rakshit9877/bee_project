// Symptom weighting and scoring logic

const SYMPTOM_WEIGHTS = {
  chestPain: 9,
  breathingDifficulty: 9,
  severeBleeding: 8,
  highFever: 7,
  severeAbdominalPain: 6,
  suspectedFracture: 6,
  persistentVomiting: 5,
  severeHeadache: 3,
  soreThroat: 2,
  coldCough: 2,
  minorCutsBruises: 1,
  fatigue: 1
};

const DURATION_BONUS = {
  lt1h: 10,
  '1to6h': 6,
  '6to24h': 3,
  gt24h: 0
};

const VITAL_FLAG_BONUS = 15;

/**
 * Basic keyword analysis for additional notes.
 */
function analyzeTextScore(text) {
  if (!text) return 0;
  let bonus = 0;
  const lower = text.toLowerCase();
  const keywords = ['pain', 'blood', 'emergency', 'severe', 'faint', 'crash', 'unconscious', 'bleeding'];
  
  keywords.forEach(word => {
    if (lower.includes(word)) bonus += 2; // +2 per keyword, max cap handled later if needed
  });
  
  return Math.min(bonus, 10); // cap text bonus at 10
}

/**
 * Computes the triage score based on form data.
 * 
 * Formula terms explained:
 * 1. baseScore: Sum of the weights of all selected symptoms.
 * 2. severityFactor: Scales the symptom weight based on the patient's subjective pain/severity 
 *    rating (1-10 slider), converted to a multiplier from 1.1x to 2.0x.
 * 3. durationBonus: Rewards sudden onset (e.g. < 1 hr gets +10) because acute changes are 
 *    often more critical than chronic issues.
 * 4. vitalFlagBonus: Flat +15 per vital "red flag" selected (e.g. fainting, high fever), 
 *    because these are objective, immediate warning signs.
 */
function computeTriageScore(formData) {
  let baseScore = 0;
  formData.symptoms.forEach(symp => {
    if (SYMPTOM_WEIGHTS[symp]) {
      baseScore += SYMPTOM_WEIGHTS[symp];
    }
  });

  // severitySlider is 1-10 -> factor range 1.1-2.0
  const severityFactor = 1 + (formData.severity / 10);
  
  const durationBonus = DURATION_BONUS[formData.duration] || 0;
  
  const vitalFlagBonus = formData.vitalFlags.length * VITAL_FLAG_BONUS;

  const textBonus = analyzeTextScore(formData.additionalInfo);

  const total = (baseScore * severityFactor) + durationBonus + vitalFlagBonus + textBonus;
  
  // Return rounded to 1 decimal place to avoid floating point weirdness in display
  return Math.round(total * 10) / 10;
}

/**
 * Helper to explain the score breakdown for the UI confirmation panel.
 */
function explainScore(formData) {
  let baseScore = 0;
  formData.symptoms.forEach(symp => {
    if (SYMPTOM_WEIGHTS[symp]) baseScore += SYMPTOM_WEIGHTS[symp];
  });

  const severityFactor = 1 + (formData.severity / 10);
  const durationBonus = DURATION_BONUS[formData.duration] || 0;
  const vitalFlagBonus = formData.vitalFlags.length * VITAL_FLAG_BONUS;
  const textBonus = analyzeTextScore(formData.additionalInfo);
  
  return {
    baseScore,
    severityFactor: severityFactor.toFixed(1),
    durationBonus,
    vitalFlagBonus,
    textBonus,
    total: Math.round(((baseScore * severityFactor) + durationBonus + vitalFlagBonus + textBonus) * 10) / 10
  };
}
