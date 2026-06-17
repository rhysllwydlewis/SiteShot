import crypto from 'node:crypto';

export function splitList(value, separator = ',') {
  if (Array.isArray(value)) return value.map(String).map(item => item.trim()).filter(Boolean);
  return String(value || '').split(separator).map(item => item.trim()).filter(Boolean);
}

export function canonicaliseAuditUrl(urlString) {
  const url = new URL(urlString);
  url.hash = '';
  if (url.pathname !== '/' && url.pathname.endsWith('/')) {
    url.pathname = url.pathname.replace(/\/+$/, '');
  }
  return url.href;
}

export function withTrailingSlash(urlString) {
  const url = new URL(urlString);
  url.hash = '';
  if (url.pathname !== '/' && !url.pathname.endsWith('/')) url.pathname += '/';
  return url.href;
}

export function normalisePageUrl(baseUrl, pagePath) {
  const base = new URL(baseUrl);
  const url = /^https?:\/\//i.test(pagePath)
    ? new URL(pagePath)
    : new URL(pagePath.startsWith('/') ? pagePath : `/${pagePath}`, base.origin);
  return canonicaliseAuditUrl(url.href);
}

export function safeNameFromUrl(urlString) {
  const url = new URL(urlString);
  const raw = (url.pathname === '/' ? 'home' : url.pathname.replace(/^\/+|\/+$/g, '').replace(/\//g, '__')) || 'home';
  const searchHash = url.search ? `__${crypto.createHash('sha1').update(url.search).digest('hex').slice(0, 6)}` : '';
  return `${raw}${searchHash}`.replace(/[^a-z0-9_-]+/gi, '-').toLowerCase();
}

export function escapeHtml(input) {
  return String(input ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]));
}

export function csvEscape(value) {
  const s = String(value ?? '');
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function truncate(input, length = 240) {
  const s = String(input ?? '');
  return s.length > length ? `${s.slice(0, length - 1)}…` : s;
}

export const SKIP_EXTENSIONS = ['.pdf', '.zip', '.rar', '.7z', '.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.ico', '.css', '.js', '.map', '.json', '.xml', '.txt', '.mp4', '.mov', '.webm', '.mp3', '.wav', '.woff', '.woff2', '.ttf', '.eot'];

export function shouldSkipUrl(urlString, baseOrigin, includeList, excludeList) {
  let url;
  try { url = new URL(urlString); } catch { return true; }
  if (!['http:', 'https:'].includes(url.protocol)) return true;
  if (url.origin !== baseOrigin) return true;
  const lowerPath = url.pathname.toLowerCase();
  if (SKIP_EXTENSIONS.some(ext => lowerPath.endsWith(ext))) return true;
  const combined = `${url.pathname}${url.search}`.toLowerCase();
  if (excludeList.some(ex => ex && combined.includes(ex.toLowerCase()))) return true;
  if (includeList.length && !includeList.some(inc => combined.includes(inc.toLowerCase()))) return true;
  return false;
}

export function isLikelySameSite(baseUrl, targetUrl) {
  try { return new URL(baseUrl).origin === new URL(targetUrl).origin; } catch { return false; }
}


export function cleanQueryForAudit(urlString) {
  const url = new URL(urlString);
  // Keep query strings only when they look like intentional public routes.
  // Tracking and state/query duplicates are removed for discovery.
  const remove = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'fbclid', 'gclid', 'msclkid', 'session', 'sid'];
  for (const key of remove) url.searchParams.delete(key);
  return canonicaliseAuditUrl(url.href);
}
