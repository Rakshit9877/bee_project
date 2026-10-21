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

const VALID_FLAGS = [
  'breathingDifficulty',
  'chestPain',
  'highFever',
  'severeBleeding',
  'faintingDizziness',
  'rapidHeartbeat'
];

const DURATION_BONUSES = {
  lt1h: 10,
  '1to6h': 6,
  '6to24h': 3,
  gt24h: 0
};

const EMERGENCY_KEYWORDS = [
  'pain', 'blood', 'emergency', 'severe', 'faint', 'crash', 'unconscious', 'bleeding'
];

function calculateTriageScore({ symptoms, severity, duration, additionalInfo = '', vitalFlags = [] }) {
  const uniqueSymptoms = [...new Set(symptoms || [])];
  const uniqueFlags = [...new Set(vitalFlags || [])];

  const baseScore = uniqueSymptoms.reduce((sum, s) => sum + (SYMPTOM_WEIGHTS[s] || 0), 0);
  const severityFactor = 1 + (severity / 10);
  const durationBonus = DURATION_BONUSES[duration] || 0;
  const vitalFlagBonus = uniqueFlags.length * 15;

  const lowerText = (additionalInfo || '').toLowerCase();
  const keywordScore = EMERGENCY_KEYWORDS.reduce((sum, word) => {
    return sum + (lowerText.includes(word) ? 2 : 0);
  }, 0);
  const textBonus = Math.min(keywordScore, 10);

  const total = (baseScore * severityFactor) + durationBonus + vitalFlagBonus + textBonus;
  return Math.round(total * 10) / 10;
}

module.exports = {
  SYMPTOM_WEIGHTS,
  VALID_FLAGS,
  DURATION_BONUSES,
  calculateTriageScore
};
