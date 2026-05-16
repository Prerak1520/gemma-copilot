const RECOMMENDATIONS = new Set(['apply', 'tailor_first', 'skip']);
const SEVERITIES = new Set(['low', 'medium', 'high']);

function typeOf(value) {
  if (Array.isArray(value)) return 'array';
  if (value === null) return 'null';
  return typeof value;
}

function requireString(obj, key, errors, { allowEmpty = false } = {}) {
  if (typeof obj[key] !== 'string') {
    errors.push(`${key} must be a string`);
    return;
  }
  if (!allowEmpty && !obj[key].trim()) errors.push(`${key} cannot be empty`);
}

function requireStringArray(obj, key, errors, max = 5) {
  if (!Array.isArray(obj[key])) {
    errors.push(`${key} must be an array`);
    return;
  }
  if (obj[key].length > max) errors.push(`${key} must contain at most ${max} items`);
  obj[key].forEach((item, index) => {
    if (typeof item !== 'string') errors.push(`${key}[${index}] must be a string`);
  });
}

export function parseJsonObject(raw) {
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {
      ok: false,
      value: null,
      errors: ['model returned invalid JSON'],
      raw: String(raw || '').slice(0, 4000)
    };
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return {
      ok: false,
      value: parsed,
      errors: [`model JSON must be an object, got ${typeOf(parsed)}`],
      raw: String(raw || '').slice(0, 4000)
    };
  }

  return { ok: true, value: parsed, errors: [], raw: null };
}

export function validateAnalysisResult(result) {
  const errors = [];

  if (typeof result.ats_score !== 'number' || !Number.isFinite(result.ats_score)) {
    errors.push('ats_score must be a finite number');
  } else if (result.ats_score < 0 || result.ats_score > 100) {
    errors.push('ats_score must be between 0 and 100');
  }

  requireString(result, 'fit_summary', errors);
  requireStringArray(result, 'matches', errors);
  requireStringArray(result, 'skills_gap', errors);
  requireStringArray(result, 'deal_breaker_hit', errors);
  requireString(result, 'salary_transparency', errors);
  if (result.salary_range !== null && typeof result.salary_range !== 'string') {
    errors.push('salary_range must be a string or null');
  }

  if (!RECOMMENDATIONS.has(result.recommendation)) {
    errors.push('recommendation must be one of apply, tailor_first, skip');
  }
  requireString(result, 'rationale', errors);

  if (!Array.isArray(result.red_flags)) {
    errors.push('red_flags must be an array');
  } else {
    if (result.red_flags.length > 5) errors.push('red_flags must contain at most 5 items');
    result.red_flags.forEach((flag, index) => {
      if (!flag || typeof flag !== 'object' || Array.isArray(flag)) {
        errors.push(`red_flags[${index}] must be an object`);
        return;
      }
      if (typeof flag.signal !== 'string' || !flag.signal.trim()) {
        errors.push(`red_flags[${index}].signal must be a non-empty string`);
      }
      if (!SEVERITIES.has(flag.severity)) {
        errors.push(`red_flags[${index}].severity must be low, medium, or high`);
      }
      if (typeof flag.evidence !== 'string' || !flag.evidence.trim()) {
        errors.push(`red_flags[${index}].evidence must be a non-empty string`);
      }
    });
  }

  return { ok: errors.length === 0, errors };
}

export function makePartialFailure({ skill, model, raw, errors, result = null }) {
  return {
    status: 'partial_failure',
    error: 'model_output_validation_failed',
    skill_name: skill.name,
    skill_version: skill.version,
    model,
    validation_errors: errors,
    result,
    raw: raw ? String(raw).slice(0, 4000) : null
  };
}
