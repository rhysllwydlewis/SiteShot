import { makeIssue } from '../core/issues.mjs';

export async function runPrivacyModule(page, url) {
  const data = await page.evaluate(() => {
    const text = document.body?.innerText || '';
    const links = [...document.querySelectorAll('a[href]')].map(a => ({ href: a.href, text: a.innerText.trim().toLowerCase() }));
    const hasPrivacy = links.some(a => a.text.includes('privacy') || a.href.toLowerCase().includes('privacy'));
    const hasTerms = links.some(a => a.text.includes('terms') || a.href.toLowerCase().includes('terms'));
    const hasCookieText = /cookie|consent|gdpr|privacy/i.test(text);
    const trackingHints = [...document.querySelectorAll('script[src], iframe[src]')].map(el => el.src).filter(src => /google-analytics|googletagmanager|facebook|meta|hotjar|clarity|segment|mixpanel|tiktok/i.test(src)).slice(0, 40);
    return { hasPrivacy, hasTerms, hasCookieText, trackingHints };
  });

  const issues = [];
  const add = obj => issues.push(makeIssue({ module: 'privacy', category: 'Privacy', url, ...obj }));
  if (!data.hasPrivacy) add({ severity: 'High', title: 'No obvious privacy policy link', description: 'No visible privacy policy link was detected.', recommendation: 'Add a clear privacy policy link in the footer or relevant navigation.' });
  if (!data.hasTerms) add({ severity: 'Low', title: 'No obvious terms link', description: 'No visible terms link was detected.', recommendation: 'Add terms or legal policy links where appropriate.' });
  if (data.trackingHints.length && !data.hasCookieText) add({ severity: 'Medium', title: 'Tracking scripts without obvious cookie/privacy wording', description: 'Tracking or analytics scripts were detected but no obvious cookie/privacy text was found on the page.', evidence: data.trackingHints.join('\n'), recommendation: 'Confirm cookie consent and privacy disclosures are implemented correctly.' });
  return { data, issues };
}
