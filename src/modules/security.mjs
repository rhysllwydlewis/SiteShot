import { makeIssue } from '../core/issues.mjs';
import { normalisePageUrl } from '../lib/utils.mjs';

function assessCsp(csp) {
  const problems = [];
  if (!csp) return problems;
  if (/unsafe-inline/i.test(csp)) problems.push('uses unsafe-inline');
  if (/unsafe-eval/i.test(csp)) problems.push('uses unsafe-eval');
  if (/(^|[\s;])default-src\s+\*/i.test(csp) || /script-src[^;]*\*/i.test(csp)) problems.push('uses wildcard source');
  if (!/frame-ancestors/i.test(csp)) problems.push('missing frame-ancestors directive');
  if (!/object-src/i.test(csp)) problems.push('missing object-src directive');
  if (!/base-uri/i.test(csp)) problems.push('missing base-uri directive');
  return problems;
}

function versionLessThan(version, minimum) {
  const a = String(version).split('.').map(n => Number(n) || 0);
  const b = String(minimum).split('.').map(n => Number(n) || 0);
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
    if ((a[i] || 0) < (b[i] || 0)) return true;
    if ((a[i] || 0) > (b[i] || 0)) return false;
  }
  return false;
}

function detectLibrariesFromUrls(urls) {
  const findings = [];
  for (const url of urls) {
    const lower = url.toLowerCase();
    const jq = lower.match(/jquery[-.](\d+\.\d+\.\d+)/);
    if (jq) findings.push({ name: 'jQuery', version: jq[1], url, potentiallyOld: versionLessThan(jq[1], '3.5.0') });
    const bs = lower.match(/bootstrap(?:\.bundle)?[-.](\d+\.\d+\.\d+)/);
    if (bs) findings.push({ name: 'Bootstrap', version: bs[1], url, potentiallyOld: versionLessThan(bs[1], '4.6.0') });
  }
  return findings;
}

export async function runSecurityModule(page, context, url, response, browserContext) {
  const headers = response ? response.headers() : {};
  const issues = [];
  const add = obj => issues.push(makeIssue({ module: 'security', category: 'Security', url, ...obj }));

  const isHttps = new URL(url).protocol === 'https:';

  if (isHttps && !headers['strict-transport-security']) add({ severity: 'Medium', title: 'Missing HSTS header', description: 'Strict-Transport-Security is not present.', recommendation: 'Add HSTS once HTTPS is correctly configured across the site.' });
  if (!headers['content-security-policy']) add({ severity: 'High', title: 'Missing Content-Security-Policy', description: 'No CSP header was found.', recommendation: 'Add a Content-Security-Policy to reduce script injection and framing risks.' });
  else {
    const cspProblems = assessCsp(headers['content-security-policy']);
    if (cspProblems.length) add({ severity: 'Medium', title: 'Weak Content-Security-Policy', description: 'The CSP contains patterns that reduce its protection.', evidence: cspProblems.join(', '), recommendation: 'Tighten CSP sources and avoid unsafe-inline/unsafe-eval where possible.' });
  }
  if (!headers['x-content-type-options']) add({ severity: 'Low', title: 'Missing X-Content-Type-Options', description: 'The response is missing X-Content-Type-Options.', recommendation: 'Add X-Content-Type-Options: nosniff.' });
  if (!headers['referrer-policy']) add({ severity: 'Low', title: 'Missing Referrer-Policy', description: 'The response is missing Referrer-Policy.', recommendation: 'Add a privacy-appropriate Referrer-Policy.' });
  if (!headers['permissions-policy']) add({ severity: 'Low', title: 'Missing Permissions-Policy', description: 'The response is missing Permissions-Policy.', recommendation: 'Restrict browser features not needed by the site.' });
  if (!headers['x-frame-options'] && !(headers['content-security-policy'] || '').includes('frame-ancestors')) add({ severity: 'Medium', title: 'Missing clickjacking protection', description: 'No X-Frame-Options or CSP frame-ancestors directive was found.', recommendation: 'Add CSP frame-ancestors or X-Frame-Options where appropriate.' });
  if (headers['x-powered-by']) add({ severity: 'Low', title: 'Technology disclosure header', description: 'X-Powered-By discloses framework/server information.', evidence: headers['x-powered-by'], recommendation: 'Remove X-Powered-By in production.' });
  if (headers['server']) add({ severity: 'Info', title: 'Server header visible', description: 'The Server header is visible.', evidence: headers['server'], recommendation: 'Consider minimising server version disclosure.' });
  if (/^\*/.test(headers['access-control-allow-origin'] || '') && /true/i.test(headers['access-control-allow-credentials'] || '')) {
    add({ severity: 'High', title: 'Unsafe CORS header combination', description: 'CORS allows any origin while credentials are enabled.', evidence: 'Access-Control-Allow-Origin: * with credentials', recommendation: 'Restrict CORS origins and avoid wildcard origins with credentials.' });
  }

  const pageData = await page.evaluate(() => {
    const origin = location.origin;
    const insecure = [...document.querySelectorAll('a[href^="http://"], img[src^="http://"], script[src^="http://"], link[href^="http://"], iframe[src^="http://"]')].map(el => el.href || el.src).slice(0, 80);
    const httpForms = [...document.querySelectorAll('form[action^="http://"]')].map(f => f.action).slice(0, 30);
    const scripts = [...document.querySelectorAll('script[src]')].map(s => ({ src: s.src, integrity: s.integrity || '', crossOrigin: s.crossOrigin || '' })).slice(0, 120);
    const styles = [...document.querySelectorAll('link[rel~="stylesheet"][href]')].map(l => ({ href: l.href, integrity: l.integrity || '', crossOrigin: l.crossOrigin || '' })).slice(0, 80);
    const externalNoSri = [
      ...scripts.filter(s => s.src && !s.src.startsWith(origin) && !s.integrity).map(s => s.src),
      ...styles.filter(s => s.href && !s.href.startsWith(origin) && !s.integrity).map(s => s.href)
    ].slice(0, 40);
    const sourcemaps = [...document.querySelectorAll('script[src$=".map"], link[href$=".map"]')].map(el => el.src || el.href).slice(0, 30);
    const targetBlankWeak = [...document.querySelectorAll('a[target="_blank"]')].filter(a => !/\bnoopener\b/i.test(a.rel || '')).map(a => a.href).slice(0, 40);
    const iframes = [...document.querySelectorAll('iframe')].map(i => ({ src: i.src, sandbox: i.getAttribute('sandbox') || '', title: i.title || '' })).slice(0, 40);
    const unsandboxedIframes = iframes.filter(i => !i.sandbox).map(i => i.src).slice(0, 20);
    const autocompletePasswords = [...document.querySelectorAll('input[type="password"]')].map(i => ({ autocomplete: i.getAttribute('autocomplete') || '', name: i.getAttribute('name') || '' })).slice(0, 20);
    const hiddenInputs = [...document.querySelectorAll('input[type="hidden"]')].map(i => i.name || i.id || '').filter(Boolean).slice(0, 60);
    return { insecure, httpForms, sourcemaps, externalNoSri, targetBlankWeak, iframes, unsandboxedIframes, autocompletePasswords, hiddenInputs, scripts: scripts.map(s => s.src), styles: styles.map(s => s.href) };
  });

  if (pageData.insecure.length) add({ severity: 'High', title: 'Insecure HTTP resources or links', description: 'The page references insecure HTTP URLs.', evidence: pageData.insecure.join('\n'), recommendation: 'Use HTTPS URLs for all resources, forms and links.' });
  if (pageData.httpForms.length) add({ severity: 'High', title: 'Insecure HTTP form action', description: 'A form submits to an HTTP endpoint.', evidence: pageData.httpForms.join('\n'), recommendation: 'Use HTTPS for all form submissions.' });
  if (pageData.sourcemaps.length) add({ severity: 'Info', title: 'Public sourcemap references', description: 'Sourcemap files are referenced publicly.', evidence: pageData.sourcemaps.join('\n'), recommendation: 'Confirm whether public sourcemaps are intentional.' });
  if (pageData.externalNoSri.length) add({ severity: 'Low', title: 'External scripts/styles without Subresource Integrity', description: 'External resources are loaded without SRI.', evidence: pageData.externalNoSri.join('\n'), recommendation: 'Add integrity attributes to trusted CDN resources where practical.' });
  if (pageData.targetBlankWeak.length) add({ severity: 'Medium', title: 'target="_blank" links missing noopener', description: 'Links opening a new tab should use rel="noopener" to reduce reverse-tabnabbing risk.', evidence: pageData.targetBlankWeak.join('\n'), recommendation: 'Add rel="noopener noreferrer" to target="_blank" links.' });
  if (pageData.unsandboxedIframes.length) add({ severity: 'Low', title: 'Iframes without sandbox attribute', description: 'One or more iframes are embedded without sandbox restrictions.', evidence: pageData.unsandboxedIframes.join('\n'), recommendation: 'Add an appropriate sandbox attribute where the iframe does not need full privileges.' });

  const libraries = detectLibrariesFromUrls([...(pageData.scripts || []), ...(pageData.styles || [])]);
  const oldLibs = libraries.filter(l => l.potentiallyOld);
  if (oldLibs.length) add({ severity: 'Medium', title: 'Potentially old frontend library detected', description: 'A visible asset filename suggests an older frontend library version.', evidence: oldLibs.map(l => `${l.name} ${l.version}: ${l.url}`).join('\n'), recommendation: 'Confirm the actual library version and upgrade if it is no longer maintained or has known vulnerabilities.' });

  const cookies = await browserContext.cookies(url).catch(() => []);
  const weakCookies = cookies.filter(c => !c.secure || !c.sameSite || (c.sameSite === 'None' && !c.secure)).slice(0, 20);
  if (weakCookies.length) add({ severity: 'Medium', title: 'Cookies with weak security attributes', description: 'Some cookies appear to be missing Secure or SameSite protection.', evidence: weakCookies.map(c => `${c.name}: secure=${c.secure}, sameSite=${c.sameSite}`).join('\n'), recommendation: 'Set Secure, HttpOnly where applicable, and an appropriate SameSite value.' });

  const exposureResults = [];
  if (context.security?.checkCommonExposures !== false) {
    const paths = context.security?.commonExposurePaths || ['/.env', '/.git/config', '/server-status', '/debug', '/backup.zip', '/db.sql', '/.well-known/security.txt'];
    for (const p of paths.slice(0, 50)) {
      try {
        const checkUrl = normalisePageUrl(url, p);
        const res = await page.request.get(checkUrl, { timeout: 8000, maxRedirects: 0 });
        const status = res.status();
        const len = Number(res.headers()['content-length'] || 0);
        exposureResults.push({ url: checkUrl, status, contentLength: len });
        if (status === 200 && !p.includes('security.txt')) add({ severity: 'Critical', title: 'Potential exposed sensitive path', description: 'A common sensitive/debug/backup path returned HTTP 200. This is a passive status check only.', evidence: `${checkUrl} returned 200`, recommendation: 'Immediately verify whether this path is exposed and remove or restrict access.' });
        if (p.includes('security.txt') && status >= 400) add({ severity: 'Info', title: 'security.txt not found', description: 'No security.txt file was found at the standard location.', evidence: `${checkUrl} returned ${status}`, recommendation: 'Consider adding /.well-known/security.txt for responsible disclosure contact details.' });
      } catch {}
    }
  }

  return { data: { headers, pageData, exposureResults, libraries, cookies: cookies.map(c => ({ name: c.name, domain: c.domain, secure: c.secure, sameSite: c.sameSite })) }, issues };
}
