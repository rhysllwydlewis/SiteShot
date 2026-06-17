import crypto from 'node:crypto';

export const SEVERITIES = ['Critical', 'High', 'Medium', 'Low', 'Info'];

export function issueId(category, title, url, selector = '', evidence = '') {
  return crypto.createHash('sha1').update(`${category}|${title}|${url}|${selector}`).digest('hex').slice(0, 10);
}

export function makeIssue({
  category,
  severity = 'Info',
  title,
  description,
  url,
  evidence = '',
  selector = '',
  screenshot = '',
  recommendation = '',
  confidence = 'Medium',
  impact = '',
  effort = 'Medium',
  owner = 'Developer',
  module = '',
  tags = []
}) {
  return {
    id: issueId(category, title, url, selector, evidence),
    module,
    category,
    severity,
    title,
    description,
    url,
    evidence,
    selector,
    screenshot,
    recommendation,
    confidence,
    impact,
    effort,
    owner,
    tags
  };
}

export function dedupeIssues(issues) {
  const map = new Map();
  for (const issue of issues) {
    const key = issue.id;
    if (!map.has(key)) map.set(key, issue);
  }
  return [...map.values()];
}

export function sortIssues(issues) {
  const order = { Critical: 0, High: 1, Medium: 2, Low: 3, Info: 4 };
  return [...issues].sort((a, b) => (order[a.severity] ?? 99) - (order[b.severity] ?? 99) || a.category.localeCompare(b.category) || a.title.localeCompare(b.title));
}
