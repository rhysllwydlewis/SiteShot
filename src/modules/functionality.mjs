import { makeIssue } from '../core/issues.mjs';
import { isLikelySameSite } from '../lib/utils.mjs';

export async function runFunctionalityModule(page, url, networkLog, context) {
  const data = await page.evaluate(() => {
    const emptyHrefs = [...document.querySelectorAll('a[href=""], a[href="#"], a[href="javascript:void(0)"]')].map(a => a.innerText.trim().slice(0, 100)).slice(0, 80);
    const anchors = [...document.querySelectorAll('a[href]')].map(a => ({ href: a.href, text: a.innerText.trim().slice(0, 100) })).slice(0, 250);
    const duplicateIds = (() => {
      const seen = new Map();
      for (const el of document.querySelectorAll('[id]')) seen.set(el.id, (seen.get(el.id) || 0) + 1);
      return [...seen.entries()].filter(([, count]) => count > 1).map(([id, count]) => ({ id, count })).slice(0, 80);
    })();
    const forms = [...document.querySelectorAll('form')].map(form => ({
      action: form.action || '',
      method: form.method || 'get',
      inputCount: form.querySelectorAll('input,select,textarea').length,
      hasSubmit: !!form.querySelector('button[type="submit"], input[type="submit"], button:not([type])')
    }));
    const buttonsLikelyDead = [...document.querySelectorAll('button')].filter(b => {
      const text = (b.innerText || '').trim();
      const type = b.getAttribute('type') || '';
      const hasHandler = b.getAttributeNames().some(n => n.startsWith('on')) || b.closest('form') || b.getAttribute('data-action') || b.getAttribute('aria-controls');
      return text && !hasHandler && type !== 'submit';
    }).map(b => b.innerText.trim().slice(0, 100)).slice(0, 40);
    return { emptyHrefs, anchors, duplicateIds, forms, buttonsLikelyDead };
  });

  const issues = [];
  const add = obj => issues.push(makeIssue({ module: 'functionality', category: 'Functionality', url, ...obj }));
  const failed = (networkLog || []).filter(r => r.status >= 400 || r.failed);
  if (failed.length) add({ severity: 'High', title: 'Failed network requests', description: 'Some page requests failed during load.', evidence: failed.slice(0, 15).map(r => `${r.status || 'ERR'} ${r.url}`).join('\n'), recommendation: 'Fix failed assets/API calls and confirm correct routing.' });
  if (data.emptyHrefs.length) add({ severity: 'Medium', title: 'Placeholder or empty links', description: 'Some links appear to be placeholders.', evidence: data.emptyHrefs.join(' | '), recommendation: 'Replace placeholder links with real destinations or convert to buttons.' });
  if (data.duplicateIds.length) add({ severity: 'Medium', title: 'Duplicate element IDs', description: 'Duplicate IDs can break labels, anchors and JavaScript selectors.', evidence: JSON.stringify(data.duplicateIds.slice(0, 12)), recommendation: 'Ensure all IDs are unique per page.' });
  const httpForms = data.forms.filter(f => /^http:\/\//i.test(f.action));
  if (httpForms.length) add({ severity: 'High', title: 'Form posts to insecure HTTP', description: 'A form action uses HTTP rather than HTTPS.', evidence: JSON.stringify(httpForms), recommendation: 'Change form actions to HTTPS.' });
  const noSubmit = data.forms.filter(f => f.inputCount > 0 && !f.hasSubmit);
  if (noSubmit.length) add({ severity: 'Low', title: 'Forms may lack clear submit controls', description: 'Some forms have inputs but no obvious submit button.', evidence: `${noSubmit.length} form(s).`, recommendation: 'Confirm each form can be completed and submitted clearly.' });
  if (data.buttonsLikelyDead.length) add({ severity: 'Low', title: 'Buttons may lack obvious actions', description: 'Some buttons do not show clear signs of handling an action.', evidence: data.buttonsLikelyDead.join(' | '), recommendation: 'Confirm these controls are wired up and accessible.' });

  const checkedLinks = [];
  const seen = new Set();
  for (const a of data.anchors) {
    if (!a.href || seen.has(a.href) || !isLikelySameSite(context.baseUrl || url, a.href)) continue;
    seen.add(a.href);
    if (checkedLinks.length >= 40) break;
    try {
      const res = await page.request.get(a.href, { timeout: 8000, maxRedirects: 3 });
      checkedLinks.push({ href: a.href, status: res.status(), text: a.text });
    } catch {
      checkedLinks.push({ href: a.href, status: 0, text: a.text });
    }
  }
  const brokenLinks = checkedLinks.filter(l => l.status === 0 || l.status >= 400);
  if (brokenLinks.length) add({ severity: 'High', title: 'Broken internal links', description: 'Some internal links returned an error status.', evidence: brokenLinks.slice(0, 12).map(l => `${l.status} ${l.href}`).join('\n'), recommendation: 'Update or remove broken links.' });
  data.checkedLinks = checkedLinks;
  return { data, issues };
}
