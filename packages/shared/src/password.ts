/** Shared password policy + strength evaluation (used by both signup forms and both APIs). */
export interface PasswordRule {
  id: string;
  label: string;
  met: boolean;
}

export interface PasswordEvaluation {
  rules: PasswordRule[];
  score: 0 | 1 | 2 | 3 | 4;
  label: 'Too weak' | 'Weak' | 'Fair' | 'Strong' | 'Excellent';
  isValid: boolean;
}

/** Enforced server-side; the UI shows the same list as a live checklist. */
export function evaluatePassword(password: string): PasswordEvaluation {
  const rules: PasswordRule[] = [
    { id: 'length', label: 'At least 8 characters', met: password.length >= 8 },
    { id: 'uppercase', label: 'One capital letter (A-Z)', met: /[A-Z]/.test(password) },
    { id: 'lowercase', label: 'One lowercase letter (a-z)', met: /[a-z]/.test(password) },
    { id: 'number', label: 'One number (0-9)', met: /\d/.test(password) },
    { id: 'symbol', label: 'One symbol (e.g. !@#$%)', met: /[^A-Za-z0-9\s]/.test(password) },
  ];

  const metCount = rules.filter((r) => r.met).length;
  // Length beyond the minimum earns depth: 12+ chars counts like an extra rule.
  const bonus = password.length >= 12 ? 1 : 0;
  const raw = Math.min(4, Math.floor((metCount + bonus) / 1.5));

  const labels = ['Too weak', 'Weak', 'Fair', 'Strong', 'Excellent'] as const;
  const score = raw as 0 | 1 | 2 | 3 | 4;

  return {
    rules,
    score,
    label: labels[score],
    // Every rule is mandatory — "one capital letter and other things" enforced.
    isValid: rules.every((r) => r.met),
  };
}
