import fs from 'node:fs/promises';
import path from 'node:path';
import { escapeHtml, csvEscape, truncate } from '../lib/utils.mjs';
import { sortIssues, dedupeIssues } from '../core/issues.mjs';
import { scoreIssues, severityCounts, riskLabel } from '../core/scoring.mjs';

const REPORT_STYLE_LABELS = {
  quick: 'Basic / Quick Report',
  executive: 'Executive Summary',
  technical: 'Technical Report',
  full: 'Full Professional Report',
  client: 'Client Report'
};

function reportStyleLabel(style) {
  return REPORT_STYLE_LABELS[style] || REPORT_STYLE_LABELS.full;
}

function normaliseReportStyle(style) {
  const value = String(style || 'full').toLowerCase();
  return ['quick', 'executive', 'technical', 'full', 'client'].includes(value) ? value : 'full';
}

function rawIssues(manifest) {
  return [...(manifest.siteWideIssues || []), ...manifest.results.flatMap(page => page.captures.flatMap(c => c.issues || []))];
}

function allIssues(manifest) {
  return sortIssues(dedupeIssues(rawIssues(manifest)));
}

function screenshotCount(manifest) {
  return manifest.results.flatMap(p => p.captures).reduce((s, c) => s + (c.files?.length || 0), 0);
}

function captureCount(manifest) {
  return manifest.results.flatMap(p => p.captures).length;
}

export async function writeAllReports(outDir, manifest) {
  const selectedStyle = normaliseReportStyle(manifest.options?.reportStyle || 'full');
  const issues = allIssues(manifest);
  const rawIssueCount = rawIssues(manifest).length;
  const routeNotFoundCount = manifest.results.flatMap(page => page.captures).filter(c => c.pageNotFound).length;
  const scores = scoreIssues(issues);
  const counts = severityCounts(issues);
  const summary = {
    targetUrl: manifest.targetUrl,
    createdAt: manifest.createdAt,
    selectedReportStyle: selectedStyle,
    selectedReportLabel: reportStyleLabel(selectedStyle),
    pageCount: manifest.pages.length,
    captureCount: captureCount(manifest),
    screenshotCount: screenshotCount(manifest),
    issueCount: issues.length,
    rawIssueCount,
    routeNotFoundCount,
    severityCounts: counts,
    scores,
    riskLabel: riskLabel(scores.overall)
  };

  await fs.writeFile(path.join(outDir, 'summary.json'), JSON.stringify(summary, null, 2), 'utf8');
  await fs.writeFile(path.join(outDir, 'issues.json'), JSON.stringify(issues, null, 2), 'utf8');
  await fs.writeFile(path.join(outDir, 'issues.csv'), csvForIssues(issues), 'utf8');
  await fs.writeFile(path.join(outDir, 'tickets.md'), ticketsMarkdown(issues), 'utf8');

  const variants = {
    quick: htmlReport(manifest, issues, summary, 'quick'),
    executive: htmlReport(manifest, issues, summary, 'executive'),
    technical: htmlReport(manifest, issues, summary, 'technical'),
    full: htmlReport(manifest, issues, summary, 'full'),
    client: htmlReport(manifest, issues, summary, 'client')
  };

  await fs.writeFile(path.join(outDir, 'quick-report.html'), variants.quick, 'utf8');
  await fs.writeFile(path.join(outDir, 'executive-summary.html'), variants.executive, 'utf8');
  await fs.writeFile(path.join(outDir, 'technical-report.html'), variants.technical, 'utf8');
  await fs.writeFile(path.join(outDir, 'full-report.html'), variants.full, 'utf8');
  await fs.writeFile(path.join(outDir, 'client-report.html'), variants.client, 'utf8');

  // The selected report style becomes the main report.html so PDF/Word match the user's selection.
  await fs.writeFile(path.join(outDir, 'report.html'), variants[selectedStyle] || variants.full, 'utf8');
  await fs.writeFile(path.join(outDir, 'report.md'), markdownReport(manifest, issues, summary, selectedStyle), 'utf8');
  await fs.writeFile(path.join(outDir, 'fix-roadmap.html'), roadmapHtml(manifest, issues, summary), 'utf8');
  await fs.writeFile(path.join(outDir, 'gallery.html'), galleryHtml(manifest, summary), 'utf8');

  await tryWritePdf(outDir);
  await tryWriteDocx(outDir, manifest, issues, summary, selectedStyle);
}

async function tryWritePdf(outDir) {
  try {
    const { chromium } = await import('playwright');
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto(`file://${path.resolve(outDir, 'report.html').replace(/\\/g, '/')}`, { waitUntil: 'networkidle' });
    await page.pdf({ path: path.join(outDir, 'report.pdf'), format: 'A4', printBackground: true, margin: { top: '14mm', right: '10mm', bottom: '14mm', left: '10mm' } });
    await browser.close();
  } catch (error) {
    await fs.writeFile(path.join(outDir, 'pdf-export-error.txt'), `PDF export was skipped or failed:\n${error.message}\n`, 'utf8').catch(() => {});
  }
}

async function tryWriteDocx(outDir, manifest, issues, summary, selectedStyle = 'full') {
  try {
    const docx = await import('docx');
    const { Document, Packer, Paragraph, HeadingLevel, TextRun, Table, TableRow, TableCell, WidthType } = docx;
    const maxIssues = selectedStyle === 'quick' ? 10 : selectedStyle === 'executive' || selectedStyle === 'client' ? 20 : 60;
    const topIssues = priorityIssues(issues).slice(0, maxIssues);
    const title = reportTitle(selectedStyle);
    const children = [
      new Paragraph({ text: title, heading: HeadingLevel.TITLE }),
      new Paragraph({ children: [new TextRun({ text: 'Target: ', bold: true }), new TextRun(summary.targetUrl)] }),
      new Paragraph({ children: [new TextRun({ text: 'Report style: ', bold: true }), new TextRun(summary.selectedReportLabel)] }),
      new Paragraph({ children: [new TextRun({ text: 'Overall score: ', bold: true }), new TextRun(`${summary.scores.overall}/100 (${summary.scores.grade})`)] }),
      new Paragraph({ children: [new TextRun({ text: 'Risk label: ', bold: true }), new TextRun(summary.riskLabel)] }),
      new Paragraph({ text: 'Summary', heading: HeadingLevel.HEADING_1 }),
      new Paragraph(summarySentence(summary)),
      new Paragraph({ text: selectedStyle === 'quick' ? 'Top Priorities' : 'Issue Register', heading: HeadingLevel.HEADING_1 }),
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({ children: ['Severity', 'Category', 'Issue', 'Recommendation'].map(text => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text, bold: true })] })] })) }),
          ...topIssues.map(i => new TableRow({ children: [
            new TableCell({ children: [new Paragraph(i.severity)] }),
            new TableCell({ children: [new Paragraph(i.category)] }),
            new TableCell({ children: [new Paragraph(i.title)] }),
            new TableCell({ children: [new Paragraph(truncate(i.recommendation, 220))] })
          ] }))
        ]
      })
    ];
    const doc = new Document({ sections: [{ properties: {}, children }] });
    const buffer = await Packer.toBuffer(doc);
    await fs.writeFile(path.join(outDir, 'report.docx'), buffer);
  } catch (error) {
    await fs.writeFile(path.join(outDir, 'docx-export-error.txt'), `DOCX export was skipped or failed:\n${error.message}\n`, 'utf8').catch(() => {});
  }
}

function csvForIssues(issues) {
  const headers = ['id','module','severity','category','title','url','selector','evidence','recommendation','confidence','effort','owner'];
  return [headers.join(','), ...issues.map(i => headers.map(h => csvEscape(i[h])).join(','))].join('\n');
}

function ticketsMarkdown(issues) {
  const major = priorityIssues(issues).filter(i => i.severity !== 'Info');
  const lines = ['# Developer Ticket Backlog', ''];
  for (const i of major) {
    lines.push(`## [${i.severity}] ${i.title}`, '');
    lines.push(`**Category:** ${i.category}`);
    lines.push(`**URL:** ${i.url}`);
    if (i.selector) lines.push(`**Selector:** \`${i.selector}\``);
    if (i.evidence) lines.push(`**Evidence:** ${String(i.evidence).replace(/\n/g, ' | ')}`);
    lines.push('', '### Acceptance Criteria');
    lines.push(`- The issue "${i.title}" is resolved on the affected page.`);
    lines.push('- No regression is introduced on mobile, tablet or desktop views.');
    lines.push('- The change is verified using SiteShot Auditor Studio.');
    lines.push('', '### Suggested fix');
    lines.push(i.recommendation || 'Review and correct the affected implementation.', '');
  }
  return lines.join('\n');
}

function markdownReport(manifest, issues, summary, style = 'full') {
  const lines = [];
  lines.push(`# ${reportTitle(style)}`, '');
  lines.push(`**Target:** ${manifest.targetUrl}`);
  lines.push(`**Created:** ${manifest.createdAt}`);
  lines.push(`**Report style:** ${summary.selectedReportLabel}`);
  lines.push(`**Overall score:** ${summary.scores.overall}/100 (${summary.scores.grade})`);
  lines.push(`**Risk label:** ${summary.riskLabel}`, '');
  lines.push('## Summary', '');
  lines.push(summarySentence(summary), '');

  if (style !== 'quick') {
    lines.push('## Category Scores', '');
    for (const [cat, score] of Object.entries(summary.scores.categoryScores)) lines.push(`- **${cat}:** ${score}/100`);
    lines.push('');
  }

  const max = style === 'quick' ? 10 : style === 'executive' || style === 'client' ? 20 : issues.length;
  lines.push(style === 'quick' ? '## Top Priorities' : '## Key Findings', '');
  const selected = priorityIssues(issues).slice(0, max);
  if (!selected.length) lines.push('No findings were identified.');
  for (const i of selected) {
    lines.push(`### ${i.severity}: ${i.title}`, '');
    lines.push(`- Category: ${i.category}`);
    lines.push(`- URL: ${i.url}`);
    if (style === 'technical' || style === 'full') {
      if (i.evidence) lines.push(`- Evidence: ${String(i.evidence).replace(/\n/g, ' | ')}`);
      if (i.selector) lines.push(`- Selector: ${i.selector}`);
    }
    lines.push(`- Recommendation: ${i.recommendation}`, '');
  }
  return lines.join('\n');
}

function priorityIssues(issues) {
  const severityRank = { Critical: 0, High: 1, Medium: 2, Low: 3, Info: 4 };
  return [...issues].sort((a, b) => (severityRank[a.severity] ?? 5) - (severityRank[b.severity] ?? 5) || String(a.category).localeCompare(String(b.category)) || String(a.title).localeCompare(String(b.title)));
}

function groupByCategory(issues) {
  const groups = new Map();
  for (const issue of issues) {
    const key = issue.category || 'Other';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(issue);
  }
  return [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]));
}

function scoreClass(score) {
  if (score >= 85) return 'good';
  if (score >= 65) return 'warn';
  return 'bad';
}

function reportTitle(style) {
  if (style === 'quick') return 'Basic / Quick Website Audit Report';
  if (style === 'executive') return 'Executive Website Audit Summary';
  if (style === 'technical') return 'Technical Website Audit Report';
  if (style === 'client') return 'Client Website Audit Report';
  return 'Full Professional Website Audit Report';
}

function reportDescription(style) {
  if (style === 'quick') return 'A short, decision-focused snapshot of the audit result, key risks and highest priority fixes.';
  if (style === 'executive') return 'A senior/client-friendly summary focused on business impact, risk and priority actions.';
  if (style === 'technical') return 'A developer-focused report with evidence, selectors, issue detail and implementation guidance.';
  if (style === 'client') return 'A polished client-facing report with clear language and limited technical noise.';
  return 'A complete report including executive summary, scores, key findings, full register and supporting links.';
}

function summarySentence(summary) {
  return `The audit reviewed ${summary.pageCount} page(s), ${summary.captureCount} responsive capture(s), and generated ${summary.screenshotCount} screenshot(s). It identified ${summary.issueCount} unique finding(s) after de-duplicating repeated device/capture findings. Raw occurrences before consolidation: ${summary.rawIssueCount}. Route-not-found captures detected: ${summary.routeNotFoundCount || 0}. Security checks are passive and non-invasive.`;
}

function issueCard(issue, options = {}) {
  const showEvidence = Boolean(options.showEvidence);
  return `<article class="issue ${escapeHtml(issue.severity.toLowerCase())}">
    <div class="issue-meta"><strong>${escapeHtml(issue.severity)}</strong><span>${escapeHtml(issue.category)}</span><span>${escapeHtml(issue.module)}</span></div>
    <h3>${escapeHtml(issue.title)}</h3>
    <p>${escapeHtml(issue.description)}</p>
    <p class="muted">${escapeHtml(issue.url)}</p>
    ${showEvidence && issue.selector ? `<p><b>Selector:</b> <code>${escapeHtml(issue.selector)}</code></p>` : ''}
    ${showEvidence && issue.evidence ? `<details><summary>Evidence</summary><pre>${escapeHtml(truncate(issue.evidence, 1800))}</pre></details>` : ''}
    ${issue.screenshot ? `<p><a href="./${escapeHtml(issue.screenshot)}">Open evidence screenshot</a></p>` : ''}
    <p><b>Recommendation:</b> ${escapeHtml(issue.recommendation)}</p>
  </article>`;
}

function htmlShell(title, body) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
:root{font-family:Inter,system-ui,sans-serif;color:#10252c;background:#f2f7f7;--teal:#0f766e;--ink:#10252c;--muted:#60747b;--border:#dbe7e8}
body{margin:0}.cover{padding:48px;background:radial-gradient(circle at top left,rgba(255,255,255,.24),transparent 30rem),linear-gradient(135deg,#0f766e,#10252c);color:#fff}.cover h1{font-size:44px;margin:0 0 10px}.cover p{opacity:.92;max-width:980px}.nav{display:flex;gap:10px;flex-wrap:wrap;margin-top:18px}.nav a{color:white;background:rgba(255,255,255,.15);padding:8px 12px;border-radius:999px;text-decoration:none}
main{max-width:1320px;margin:auto;padding:28px}.panel{background:white;border:1px solid var(--border);border-radius:26px;padding:24px;margin-bottom:22px;box-shadow:0 18px 48px rgba(16,37,44,.08)}.overall{font-size:74px;font-weight:950;line-height:1}.grade{font-size:28px;font-weight:900;color:#0f766e}.scores{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px}.score{border-radius:20px;padding:18px;border:1px solid var(--border)}.score span{display:block;color:var(--muted);font-size:13px}.score strong{font-size:34px}.good{background:#e9f8ee}.warn{background:#fff7e2}.bad{background:#fdecec}
.stats{display:flex;gap:10px;flex-wrap:wrap}.pill{background:#e6f6f2;color:#0b4f4a;border-radius:999px;padding:9px 12px;font-weight:800;font-size:13px}.issue-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(330px,1fr));gap:14px}.issue{background:#fff;border:1px solid var(--border);border-radius:20px;padding:16px}.issue.critical,.issue.high{border-color:#efaaa4}.issue.medium{border-color:#ffd27d}.issue h3{margin:10px 0 8px}.issue-meta{display:flex;gap:8px;flex-wrap:wrap}.issue-meta span,.issue-meta strong{font-size:12px;padding:5px 8px;border-radius:999px;background:#edf6f6}.issue-meta strong{color:#9f1d1d;background:#fdecec}.muted{color:var(--muted);font-size:13px}pre{white-space:pre-wrap;background:#0d1b1f;color:#d9fff7;padding:12px;border-radius:12px;overflow:auto}code{background:#edf6f6;padding:2px 6px;border-radius:6px}table{width:100%;border-collapse:collapse;font-size:13px}th,td{border-bottom:1px solid #e4eeee;padding:10px;text-align:left;vertical-align:top}th{background:#f7fbfb;position:sticky;top:0}a{color:#0f766e}.small{font-size:13px;color:var(--muted)}.priority-list{display:grid;gap:12px}.priority-row{border:1px solid var(--border);border-radius:18px;padding:16px;background:#fff}.priority-row strong{display:inline-block;margin-right:8px}.two-col{display:grid;grid-template-columns:1fr 1fr;gap:16px}
@media(max-width:800px){.cover h1{font-size:32px}.two-col{grid-template-columns:1fr}.overall{font-size:48px}}
@media print{.nav{display:none}.panel{box-shadow:none;break-inside:avoid}.cover{background:#0f766e!important}}
</style></head><body>${body}</body></html>`;
}

function supportNav(style = 'full') {
  const evidenceLinks = [
    '<a href="./gallery.html">Screenshot gallery</a>',
    '<a href="./fix-roadmap.html">Fix roadmap</a>',
    '<a href="./issues.csv">Issue CSV</a>',
    '<a href="./tickets.md">Developer tickets</a>'
  ];

  if (style === 'quick' || style === 'executive' || style === 'client') {
    return `<div class="nav">${evidenceLinks.join('')}</div>`;
  }

  return `<div class="nav">${[
    ...evidenceLinks,
    '<a href="./manifest.json">Audit manifest</a>',
    '<a href="./issues.json">Issue JSON</a>'
  ].join('')}</div>`;
}

function relatedReportOutputsNote(selectedStyle) {
  return `<section class="panel"><h2>Other available outputs</h2>
    <p>This document is the selected ${escapeHtml(reportStyleLabel(selectedStyle))}. Other report variants may also be generated by the app for internal use, but they are not linked in the main report header so this report remains a clear standalone deliverable.</p>
    <p class="small">Open alternate report styles from the SiteShot Auditor Studio Reports panel if needed.</p>
  </section>`;
}

function htmlReport(manifest, issues, summary, variant = 'full') {
  const style = normaliseReportStyle(variant);
  const title = reportTitle(style);
  const priority = priorityIssues(issues);
  const major = priority.filter(i => ['Critical', 'High'].includes(i.severity));
  const scoreCards = Object.entries(summary.scores.categoryScores).map(([cat, score]) => `<div class="score ${scoreClass(score)}"><span>${escapeHtml(cat)}</span><strong>${score}</strong></div>`).join('');
  const issueRows = priority.map(i => `<tr><td>${escapeHtml(i.severity)}</td><td>${escapeHtml(i.category)}</td><td>${escapeHtml(i.title)}</td><td>${escapeHtml(i.url)}</td><td>${escapeHtml(i.recommendation)}</td></tr>`).join('');

  const cover = `<section class="cover"><h1>${escapeHtml(title)}</h1><p>${escapeHtml(reportDescription(style))}</p><p>${escapeHtml(manifest.targetUrl)} · ${escapeHtml(manifest.createdAt)} · Selected style: ${escapeHtml(summary.selectedReportLabel)}</p>${supportNav(style)}</section>`;

  const summaryPanel = `<section class="panel"><h2>Summary</h2><div class="overall">${summary.scores.overall}/100 <span class="grade">${escapeHtml(summary.scores.grade)}</span></div><p><b>${escapeHtml(summary.riskLabel)}</b></p><p>${escapeHtml(summarySentence(summary))}</p><div class="stats">${Object.entries(summary.severityCounts).map(([s,c])=>`<span class="pill">${escapeHtml(s)}: ${escapeHtml(c)}</span>`).join('')}</div></section>`;

  if (style === 'quick') {
    const top = priority.slice(0, 8);
    const quickRows = top.map((i, idx) => `<div class="priority-row"><strong>${idx + 1}. ${escapeHtml(i.severity)}</strong> ${escapeHtml(i.title)}<p class="small">${escapeHtml(i.category)} · ${escapeHtml(i.url)}</p><p>${escapeHtml(i.recommendation)}</p></div>`).join('') || '<p>No priority findings were identified.</p>';
    const body = `${cover}<main>${summaryPanel}<section class="panel"><h2>Top priorities</h2><div class="priority-list">${quickRows}</div></section><section class="panel"><h2>Quick decision view</h2><div class="two-col"><div><h3>What to fix first</h3><p>Start with Critical and High findings, then Medium findings that affect conversion, trust, accessibility or routing.</p></div><div><h3>Supporting evidence</h3><p>Use the Fix Roadmap, Screenshot Gallery, Issue CSV and Developer Tickets for follow-up work.</p></div></div></section>${relatedReportOutputsNote(style)}</main>`;
    return htmlShell(title, body);
  }

  const scorePanel = `<section class="panel"><h2>Category Scores</h2><div class="scores">${scoreCards}</div></section>`;
  const keyLimit = style === 'executive' || style === 'client' ? 12 : 30;
  const showEvidence = style === 'technical' || style === 'full';
  const keyCards = (major.length ? major : priority).slice(0, keyLimit).map(i => issueCard(i, { showEvidence })).join('') || '<p>No key findings were identified.</p>';
  const keyPanel = `<section class="panel"><h2>${style === 'technical' ? 'Priority Technical Findings' : 'Key Findings'}</h2><div class="issue-grid">${keyCards}</div></section>`;

  let body = `${cover}<main>${summaryPanel}${scorePanel}${keyPanel}`;

  if (style === 'technical') {
    const grouped = groupByCategory(priority).map(([cat, list]) => `<section class="panel"><h2>${escapeHtml(cat)}</h2><div class="issue-grid">${list.map(i => issueCard(i, { showEvidence: true })).join('')}</div></section>`).join('');
    body += `<section class="panel"><h2>Developer Notes</h2><p>This technical report includes evidence and selectors where available. Use <a href="./tickets.md">developer tickets</a> and <a href="./issues.csv">issues.csv</a> for implementation planning.</p></section>${grouped}`;
  } else if (style === 'full') {
    body += `<section class="panel"><h2>Full Issue Register</h2><table><thead><tr><th>Severity</th><th>Category</th><th>Issue</th><th>URL</th><th>Recommendation</th></tr></thead><tbody>${issueRows}</tbody></table></section>`;
    body += `<section class="panel"><h2>Appendices</h2><p>Supporting outputs: <a href="./gallery.html">screenshot gallery</a>, <a href="./issues.csv">issue CSV</a>, <a href="./issues.json">issue JSON</a>, <a href="./tickets.md">developer tickets</a>, and <a href="./manifest.json">full manifest</a>.</p></section>`;
  } else {
    body += `<section class="panel"><h2>Recommended next steps</h2><ol><li>Resolve Critical and High findings first.</li><li>Review the Technical Report with the development team.</li><li>Re-run the audit after fixes to confirm progress.</li></ol></section>`;
  }

  body += relatedReportOutputsNote(style);
  body += `<section class="panel"><h2>Safety Statement</h2><p>This audit used safe, passive checks only. It did not exploit, brute-force, inject payloads, bypass login, or perform destructive testing.</p></section></main>`;
  return htmlShell(title, body);
}

function roadmapHtml(manifest, issues, summary) {
  const groups = [
    ['Immediate', priorityIssues(issues).filter(i => ['Critical','High'].includes(i.severity))],
    ['Next sprint', priorityIssues(issues).filter(i => i.severity === 'Medium')],
    ['Backlog polish', priorityIssues(issues).filter(i => ['Low','Info'].includes(i.severity))]
  ];
  const body = `<section class="cover"><h1>Prioritised Fix Roadmap</h1><p>${escapeHtml(manifest.targetUrl)} · ${summary.issueCount} unique findings</p>${supportNav(style)}</section><main>${groups.map(([name, list]) => `<section class="panel"><h2>${name}</h2>${list.length ? `<div class="issue-grid">${list.map(i => issueCard(i, { showEvidence: false })).join('')}</div>` : '<p>No items in this phase.</p>'}</section>`).join('')}</main>`;
  return htmlShell('Fix Roadmap', body);
}

function galleryHtml(manifest, summary) {
  const cards = manifest.results.flatMap(page => page.captures.flatMap(capture => (capture.files || []).map(file => `<article class="card"><a href="./${escapeHtml(file)}" target="_blank"><img src="./${escapeHtml(file)}" alt="${escapeHtml(file)}"></a><div class="meta"><strong>${escapeHtml(file.replace('screenshots/',''))}</strong><span>${escapeHtml(new URL(page.url).pathname || '/')} · ${escapeHtml(capture.deviceName)}</span><span>${capture.pageNotFound ? 'Route not found' : ((capture.issues||[]).length + ' issues')}</span></div></article>`))).join('');
  return `<!doctype html><html><head><meta charset="utf-8"><title>Screenshot Gallery</title><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;background:#f3f7f7;font-family:Inter,system-ui,sans-serif;color:#10252c}header{position:sticky;top:0;background:rgba(255,255,255,.94);backdrop-filter:blur(14px);border-bottom:1px solid #dbe7e8;padding:20px;z-index:2}main{padding:22px;display:grid;grid-template-columns:repeat(auto-fill,minmax(290px,1fr));gap:18px}.card{background:white;border:1px solid #dbe7e8;border-radius:18px;overflow:hidden;box-shadow:0 14px 34px rgba(16,37,44,.08)}img{width:100%;height:430px;object-fit:cover;object-position:top}.meta{padding:12px;display:grid;gap:4px;font-size:12px;color:#60747b}.meta strong{color:#10252c}a{color:#0f766e}</style></head><body><header><h1>Screenshot Gallery</h1><p>${summary.screenshotCount} screenshots · <a href="./report.html">Selected report</a> · <a href="./fix-roadmap.html">Fix roadmap</a></p></header><main>${cards}</main></body></html>`;
}
