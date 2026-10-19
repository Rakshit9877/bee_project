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
    if (lower.includes(word)) bonus += 2;
  });
  
  return Math.min(bonus, 10);
}

/**
 * Computes the triage score based on form data.
 */
function computeTriageScore(formData) {
  let baseScore = 0;
  formData.symptoms.forEach(symp => {
    if (SYMPTOM_WEIGHTS[symp]) {
      baseScore += SYMPTOM_WEIGHTS[symp];
    }
  });

  const severityFactor = 1 + (formData.severity / 10);
  
  const durationBonus = DURATION_BONUS[formData.duration] || 0;
  
  const vitalFlagBonus = formData.vitalFlags.length * VITAL_FLAG_BONUS;

  const textBonus = analyzeTextScore(formData.additionalInfo);

  const total = (baseScore * severityFactor) + durationBonus + vitalFlagBonus + textBonus;
  
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
