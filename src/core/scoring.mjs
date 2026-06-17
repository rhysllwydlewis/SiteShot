const weights = { Critical: 18, High: 8, Medium: 4, Low: 1.5, Info: 0.25 };

export const SCORE_CATEGORIES = ['Security', 'Privacy', 'Accessibility', 'SEO', 'Performance', 'Mobile UX', 'Functionality', 'Content / Trust', 'Technical', 'Auth / Session Readiness', 'Forms / Flow Dry Run'];

export function severityCounts(issues) {
  const out = { Critical: 0, High: 0, Medium: 0, Low: 0, Info: 0 };
  for (const issue of issues) out[issue.severity] = (out[issue.severity] || 0) + 1;
  return out;
}

export function scoreIssues(issues) {
  const categoryScores = {};
  for (const cat of SCORE_CATEGORIES) {
    const catIssues = issues.filter(i => i.category === cat);
    const penalty = catIssues.reduce((sum, i) => sum + (weights[i.severity] || 1), 0);
    categoryScores[cat] = Math.max(5, Math.round(100 - Math.min(95, penalty)));
    if (!catIssues.length) categoryScores[cat] = 100;
  }

  const scored = Object.values(categoryScores);
  const overall = Math.round(scored.reduce((sum, score) => sum + score, 0) / Math.max(1, scored.length));
  const grade = overall >= 90 ? 'A' : overall >= 80 ? 'B' : overall >= 70 ? 'C' : overall >= 55 ? 'D' : 'E';
  return { overall, grade, categoryScores };
}

export function riskLabel(score) {
  if (score >= 85) return 'Strong';
  if (score >= 70) return 'Needs attention';
  if (score >= 55) return 'Material issues';
  return 'High risk';
}
