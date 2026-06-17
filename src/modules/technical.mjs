import { makeIssue } from '../core/issues.mjs';

export async function runTechnicalModule(page, url, errors, networkLog, budgets = {}) {
  const data = await page.evaluate(() => {
    const htmlLang = document.documentElement.getAttribute('lang') || '';
    const viewport = document.querySelector('meta[name="viewport"]')?.getAttribute('content') || '';
    const duplicateScripts = (() => {
      const seen = new Map();
      for (const s of document.querySelectorAll('script[src]')) seen.set(s.src, (seen.get(s.src) || 0) + 1);
      return [...seen.entries()].filter(([, c]) => c > 1).map(([src, count]) => ({ src, count })).slice(0, 20);
    })();
    const iframes = [...document.querySelectorAll('iframe')].map(i => ({ src: i.src, title: i.title || '' })).slice(0, 20);
    return { htmlLang, viewport, duplicateScripts, iframes };
  });

  const issues = [];
  const add = obj => issues.push(makeIssue({ module: 'technical', category: 'Technical', url, ...obj }));
  const consoleErrors = (errors || []).filter(e => /^error:|pageerror:/i.test(e));
  if (consoleErrors.length > (budgets.maxConsoleErrors ?? 0)) add({ severity: 'High', title: 'Console/page errors detected', description: 'The page raised console or runtime errors.', evidence: consoleErrors.slice(0, 10).join('\n'), recommendation: 'Investigate and fix client-side errors.' });
  const failed = (networkLog || []).filter(r => r.status >= 400 || r.failed);
  if (failed.length > (budgets.maxFailedRequests ?? 0)) add({ severity: 'Medium', title: 'Failed requests detected', description: 'Network requests failed during the page load.', evidence: failed.slice(0, 10).map(r => `${r.status || 'ERR'} ${r.url}`).join('\n'), recommendation: 'Fix broken resource/API paths.' });
  if (!data.htmlLang) add({ severity: 'Low', title: 'Missing html lang attribute', description: 'The html element has no lang attribute.', recommendation: 'Add a language attribute such as lang="en-GB".' });
  if (!data.viewport) add({ severity: 'High', title: 'Missing viewport meta tag', description: 'No viewport meta tag was found.', recommendation: 'Add a responsive viewport meta tag.' });
  if (data.duplicateScripts.length) add({ severity: 'Low', title: 'Duplicate script includes', description: 'Some script files appear to be loaded more than once.', evidence: JSON.stringify(data.duplicateScripts), recommendation: 'Remove duplicate script includes.' });
  const untitledIframes = data.iframes.filter(i => !i.title);
  if (untitledIframes.length) add({ severity: 'Medium', title: 'Iframes missing titles', description: 'Some iframes have no title attribute.', evidence: JSON.stringify(untitledIframes.slice(0, 5)), recommendation: 'Add meaningful iframe titles for accessibility.' });
  return { data, issues };
}
