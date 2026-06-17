import { gunzipSync } from 'node:zlib';
import { normalisePageUrl, shouldSkipUrl, canonicaliseAuditUrl, withTrailingSlash, cleanQueryForAudit } from './utils.mjs';

const IMPORTANT_PATH_PATTERNS = [
  /^\/$/,
  /\/contact\/?$/i,
  /\/about\/?$/i,
  /\/services?\/?$/i,
  /\/pricing\/?$/i,
  /\/faq\/?$/i,
  /\/guides?\/?$/i,
  /\/blog\/?$/i,
  /\/privacy\/?$/i,
  /\/terms\/?$/i
];

const LOW_VALUE_PATH_PATTERNS = [
  /\/tag\//i,
  /\/category\//i,
  /\/author\//i,
  /\/page\/\d+/i,
  /\/wp-json/i,
  /\/feed\/?$/i,
  /\/cart\/?$/i,
  /\/checkout\/?$/i,
  /\/account\/?$/i
];

const ASSET_PATH_PREFIXES = [
  '/_next/',
  '/assets/',
  '/static/',
  '/dist/',
  '/build/',
  '/chunks/',
  '/fonts/',
  '/images/',
  '/img/',
  '/css/',
  '/js/',
  '/api/',
  '/cdn-cgi/',
  '/node_modules/'
];

const COMMON_PUBLIC_ROUTES = [
  '/',
  '/about',
  '/about-us',
  '/contact',
  '/contact-us',
  '/services',
  '/pricing',
  '/plans',
  '/features',
  '/faq',
  '/help',
  '/support',
  '/guides',
  '/blog',
  '/news',
  '/events',
  '/case-studies',
  '/privacy',
  '/privacy-policy',
  '/terms',
  '/terms-and-conditions'
];

const HTML_SITEMAP_ROUTE_SEEDS = [
  '/sitemap',
  '/sitemap.html',
  '/site-map',
  '/site-map.html',
  '/pages',
  '/all-pages'
];

export async function waitForPage(page, waitMs) {
  await page.waitForLoadState('domcontentloaded', { timeout: 45000 }).catch(() => {});
  await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
  if (waitMs > 0) await page.waitForTimeout(waitMs);
}

async function waitForDiscoveryCandidate(page, waitMs = 150) {
  await page.waitForLoadState('domcontentloaded', { timeout: 12000 }).catch(() => {});
  if (waitMs > 0) await page.waitForTimeout(waitMs);
}

async function looksLikeNotFoundPage(page) {
  try {
    const title = await page.title().catch(() => '');
    const text = await page.locator('body').innerText({ timeout: 1200 }).catch(() => '');
    const compact = `${title} ${text}`.replace(/\s+/g, ' ').trim();
    return /\b404\b|page not found|not found|doesn'?t exist|does not exist/i.test(compact.slice(0, 1200));
  } catch {
    return false;
  }
}

function decodeXmlText(value) {
  return String(value || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

function discoveryCandidate(url, source, depth = 0, meta = {}) {
  return { url: canonicaliseAuditUrl(cleanQueryForAudit(url)), source, depth, ...meta };
}

function mergeSources(a = '', b = '') {
  return [...new Set([...String(a).split('+'), ...String(b).split('+')].map(s => s.trim()).filter(Boolean))].join('+');
}

function candidateScore(item, baseUrl) {
  let score = 0;
  try {
    const url = new URL(item.url, baseUrl);
    const path = url.pathname || '/';
    score += (Number(item.depth) || 0) * 18;
    if (String(item.source || '').includes('sitemap')) score -= 18;
    if (String(item.source || '').includes('bundle-route')) score -= 14;
    if (String(item.source || '').includes('app-data')) score -= 12;
    if (String(item.source || '').includes('homepage')) score -= 8;
    if (String(item.source || '').includes('common-route')) score += 6;
    if (IMPORTANT_PATH_PATTERNS.some(pattern => pattern.test(path))) score -= 16;
    if (LOW_VALUE_PATH_PATTERNS.some(pattern => pattern.test(path))) score += 35;
    if (url.search) score += 8;
    score += Math.min(path.split('/').filter(Boolean).length * 2, 14);
  } catch {
    score += 99;
  }
  return score;
}

function uniqueCandidates(candidates, baseUrl = '') {
  const seen = new Map();
  for (const item of candidates) {
    if (!item?.url) continue;
    if (!seen.has(item.url)) {
      seen.set(item.url, item);
      continue;
    }
    const existing = seen.get(item.url);
    seen.set(item.url, {
      ...existing,
      source: mergeSources(existing.source, item.source),
      depth: Math.min(Number(existing.depth) || 0, Number(item.depth) || 0)
    });
  }
  const list = [...seen.values()];
  return baseUrl ? list.sort((a, b) => candidateScore(a, baseUrl) - candidateScore(b, baseUrl)) : list;
}

function isUsefulRoutePath(value) {
  const route = String(value || '').trim();
  if (!route.startsWith('/')) return false;
  if (route.startsWith('//')) return false;
  if (route.length > 160) return false;
  if (/\s|[{}<>]|\\/.test(route)) return false;
  if (/^\/(?:[a-f0-9]{16,}|\d+)$/.test(route)) return false;
  const lower = route.toLowerCase();
  if (ASSET_PATH_PREFIXES.some(prefix => lower.startsWith(prefix))) return false;
  if (/\.(?:js|css|map|json|xml|txt|png|jpe?g|gif|webp|svg|ico|woff2?|ttf|eot|mp4|webm|mp3|pdf|zip)(?:$|[?#])/i.test(lower)) return false;
  if (/\.(?:min|chunk)\./i.test(lower)) return false;
  return true;
}

function routeStringsFromText(text, baseUrl, source) {
  const base = new URL(baseUrl);
  const routes = [];
  const body = String(text || '').slice(0, 900000);

  const absoluteMatches = body.match(/https?:\/\/[^"'`\s<>\\)\]]+/g) || [];
  for (const raw of absoluteMatches.slice(0, 1200)) {
    try {
      const url = new URL(raw);
      url.hash = '';
      if (url.origin !== base.origin) continue;
      if (!isUsefulRoutePath(url.pathname)) continue;
      routes.push(discoveryCandidate(cleanQueryForAudit(url.href), source, 1));
    } catch {}
  }

  const pathMatches = body.match(/(?:["'`(=:\[,]|\bpath\s*:\s*)\s*(\/[A-Za-z0-9][A-Za-z0-9/_~.%?=&+#:@-]{0,155})/g) || [];
  for (const match of pathMatches.slice(0, 1800)) {
    const extracted = match.replace(/^[^/]+/, '').replace(/["'`,)\]}]+$/g, '');
    if (!isUsefulRoutePath(extracted)) continue;
    try {
      routes.push(discoveryCandidate(new URL(extracted, base.origin).href, source, 1));
    } catch {}
  }

  return uniqueCandidates(routes, baseUrl);
}

function buildCommonRouteCandidates(baseUrl, options) {
  const base = new URL(baseUrl);
  const candidates = [];
  for (const route of COMMON_PUBLIC_ROUTES) {
    try {
      const url = new URL(route, base.origin).href;
      if (!shouldSkipUrl(url, base.origin, options.includeList, options.excludeList)) candidates.push(discoveryCandidate(url, 'common-route', 1));
    } catch {}
  }
  return uniqueCandidates(candidates, baseUrl);
}

function buildHtmlSitemapSeeds(baseUrl, options) {
  const base = new URL(baseUrl);
  const seeds = [];
  for (const route of HTML_SITEMAP_ROUTE_SEEDS) {
    try {
      const url = new URL(route, base.origin).href;
      if (!shouldSkipUrl(url, base.origin, options.includeList, options.excludeList)) seeds.push(canonicaliseAuditUrl(url));
    } catch {}
  }
  return [...new Set(seeds)];
}

function sourceFamily(source) {
  const value = String(source || 'unknown');
  if (value.startsWith('sitemap:')) return 'sitemap';
  if (value === 'common-route') return 'common-route';
  if (value === 'homepage-link') return 'homepage-link';
  if (value === 'crawl-link') return 'crawl-link';
  if (value === 'crawl-seed') return 'crawl-seed';
  if (value === 'bundle-route') return 'bundle-route';
  if (value === 'app-data') return 'app-data';
  if (value === 'manual') return 'manual';
  if (value.includes('fallback')) return 'fallback';
  return value || 'unknown';
}

function sourceCounts(items = []) {
  const counts = {};
  for (const item of items) {
    const sources = String(item.source || 'unknown').split('+').map(s => sourceFamily(s.trim())).filter(Boolean);
    for (const source of sources.length ? sources : ['unknown']) counts[source] = (counts[source] || 0) + 1;
  }
  return counts;
}

function topRejectedReasons(items = []) {
  const counts = new Map();
  for (const item of items) {
    const reason = String(item.reason || item.status || 'Rejected').slice(0, 140);
    counts.set(reason, (counts.get(reason) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([reason, count]) => ({ reason, count }));
}

function discoveryQuality({ mode, included, rejected, diagnostics }) {
  const includedCount = included.length;
  const sourceMap = sourceCounts(included);
  const sourceKinds = Object.keys(sourceMap);
  const sitemapHits = diagnostics?.sitemap?.urlsFound || 0;
  const crawlPages = diagnostics?.crawl?.pagesCrawled || 0;
  const bundleRoutes = diagnostics?.crawl?.bundleRoutesFound || 0;
  const recommendations = [];

  let level = 'weak';
  let confidence = 'Low';
  if (includedCount >= 10 && sourceKinds.length >= 2) {
    level = 'strong';
    confidence = 'High';
  } else if (includedCount >= 4 || sourceKinds.length >= 2) {
    level = 'usable';
    confidence = 'Medium';
  } else if (includedCount >= 1) {
    level = 'limited';
    confidence = 'Low';
  }

  if (mode === 'sitemap' && !sitemapHits) recommendations.push('No useful XML sitemap URLs were found. Try Auto so SiteShot can combine sitemap checks with public navigation crawling.');
  if (mode === 'auto' && !sitemapHits) recommendations.push('No usable sitemap URLs were found, so Auto relied on crawling and common public route checks.');
  if (mode === 'auto' && bundleRoutes) recommendations.push(`Auto found ${bundleRoutes} candidate route(s) inside app scripts or page data.`);
  if (includedCount < 3) recommendations.push('Discovery found very few pages. The site may be app-driven, blocked, auth-gated or using routes hidden from public navigation.');
  if (rejected.length > includedCount * 2) recommendations.push('Many candidates were rejected. Check exclude rules, trailing-slash redirects and whether the site returns visible not-found pages.');
  if (!crawlPages && mode === 'auto') recommendations.push('Auto could not crawl public pages successfully. Try lowering depth or checking whether the target blocks browser automation.');

  return {
    level,
    confidence,
    message: `${confidence} confidence discovery: ${includedCount} included page${includedCount === 1 ? '' : 's'} from ${sourceKinds.length || 0} source group${sourceKinds.length === 1 ? '' : 's'}.`,
    sourceCounts: sourceMap,
    rejectedReasons: topRejectedReasons(rejected),
    recommendations
  };
}

async function tryRoute(page, url) {
  try {
    const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 12000 });
    await waitForDiscoveryCandidate(page, 150);
    const status = response?.status() ?? 0;
    const notFoundLike = await looksLikeNotFoundPage(page);
    return { requestedUrl: url, finalUrl: canonicaliseAuditUrl(page.url()), status, ok: status > 0 && status < 400 && !notFoundLike, notFoundLike, reason: status >= 400 ? `HTTP ${status}` : notFoundLike ? 'Visible not-found page' : 'OK' };
  } catch (error) {
    return { requestedUrl: url, finalUrl: url, status: 0, ok: false, error: error.message, reason: error.message };
  }
}

async function validateCandidate(browser, options, candidate) {
  const canonical = normalisePageUrl(options.url, candidate.url);
  const slash = withTrailingSlash(canonical);
  const variants = [...new Set([canonical, slash])];
  const page = await browser.newPage();
  try {
    const attempts = [];
    for (const variant of variants) {
      const result = await tryRoute(page, variant);
      attempts.push(result);
      if (result.ok) return { url: result.finalUrl, requestedUrl: candidate.url, status: result.status, source: candidate.source, depth: candidate.depth, included: true, reason: result.finalUrl !== canonical ? `Resolved to ${result.finalUrl}` : 'OK' };
    }
    const best = attempts.find(a => a.status && a.status < 500) || attempts[0] || {};
    return { url: best.finalUrl || canonical, requestedUrl: candidate.url, status: best.status || 0, source: candidate.source, depth: candidate.depth, included: false, reason: best.reason || best.error || 'Route did not validate' };
  } finally {
    await page.close().catch(() => {});
  }
}

async function validateCandidates(browser, options, candidates) {
  const included = [];
  const rejected = [];
  const seenIncluded = new Set();
  const queue = [...candidates];
  const workers = Math.min(6, Math.max(1, queue.length));

  async function worker() {
    while (queue.length && included.length < options.maxPages) {
      const candidate = queue.shift();
      if (!candidate) continue;
      const result = await validateCandidate(browser, options, candidate);
      if (result.included && !seenIncluded.has(result.url) && included.length < options.maxPages) {
        included.push(result);
        seenIncluded.add(result.url);
      } else if (!result.included) {
        rejected.push(result);
      }
    }
  }

  await Promise.all(Array.from({ length: workers }, worker));
  return { included: uniqueCandidates(included, options.url).slice(0, options.maxPages), rejected };
}

async function resolveExplicitPage(browser, options, rawPage) {
  const result = await validateCandidate(browser, options, discoveryCandidate(rawPage, 'manual', 0));
  if (result.included) {
    if (result.url !== normalisePageUrl(options.url, rawPage)) console.log(`Resolved ${rawPage} -> ${result.url}`);
    return result.url;
  }
  console.log(`Warning: manual route did not validate cleanly for ${rawPage}. Using ${result.url}. Reason: ${result.reason}`);
  return result.url;
}

async function revealNavigationControls(page) {
  const selectors = [
    'button[aria-expanded="false"]',
    '[role="button"][aria-expanded="false"]',
    'button[aria-controls]',
    '[role="button"][aria-controls]',
    'button[aria-label*="menu" i]',
    'button[aria-label*="navigation" i]',
    'button[aria-label*="more" i]',
    '[role="button"][aria-label*="menu" i]',
    '[role="button"][aria-label*="navigation" i]',
    '[data-testid*="menu" i]',
    '[data-testid*="nav" i]',
    '.hamburger',
    '.menu-toggle',
    '.nav-toggle',
    '[class*="hamburger" i]',
    '[class*="menu-toggle" i]',
    '[class*="nav-toggle" i]'
  ];

  for (const selector of selectors) {
    let handles = [];
    try { handles = await page.$$(selector); } catch { continue; }
    for (const handle of handles.slice(0, 8)) {
      try {
        const box = await handle.boundingBox();
        if (!box || box.width < 4 || box.height < 4) continue;
        await handle.click({ timeout: 1500, force: true });
        await waitForPage(page, 250);
      } catch {}
    }
  }
}

async function harvestAppRouteCandidates(page, baseUrl, includeList, excludeList) {
  const base = new URL(baseUrl);
  const found = [];
  const data = await page.evaluate(() => {
    const scripts = [...document.scripts].map(script => ({ src: script.src || '', text: script.src ? '' : (script.textContent || '').slice(0, 120000) }));
    const pageData = [
      document.querySelector('#__NEXT_DATA__')?.textContent || '',
      document.querySelector('[id="__NUXT_DATA__"]')?.textContent || '',
      document.documentElement?.outerHTML?.slice(0, 250000) || ''
    ].join('\n');
    return { scripts, pageData };
  });

  for (const item of routeStringsFromText(data.pageData, baseUrl, 'app-data')) found.push(item);
  for (const script of (data.scripts || []).slice(0, 80)) {
    if (script.text) {
      for (const item of routeStringsFromText(script.text, baseUrl, 'app-data')) found.push(item);
      continue;
    }
    if (!script.src) continue;
    try {
      const src = new URL(script.src, base.origin);
      if (src.origin !== base.origin) continue;
      if (!/\.m?js(?:$|[?#])/i.test(src.pathname)) continue;
      const text = await fetchText(page.request, src.href, 15000);
      for (const item of routeStringsFromText(text || '', baseUrl, 'bundle-route')) found.push(item);
    } catch {}
  }

  return uniqueCandidates(found.filter(item => {
    try { return !shouldSkipUrl(item.url, base.origin, includeList, excludeList); } catch { return false; }
  }), baseUrl);
}

export async function collectLinks(page, baseUrl, includeList, excludeList) {
  const base = new URL(baseUrl);
  const currentUrl = page.url() || base.href;
  const links = await page.evaluate(() => {
    const found = new Set();
    const push = value => {
      if (!value || typeof value !== 'string') return;
      const trimmed = value.trim();
      if (!trimmed || trimmed === '#' || trimmed.startsWith('javascript:') || trimmed.startsWith('mailto:') || trimmed.startsWith('tel:')) return;
      found.add(trimmed);
    };
    document.querySelectorAll('a[href],area[href]').forEach(el => push(el.getAttribute('href') || el.href));
    document.querySelectorAll('link[rel~="canonical"][href],link[rel~="alternate"][href],meta[property="og:url"][content]').forEach(el => push(el.getAttribute('href') || el.getAttribute('content')));
    document.querySelectorAll('form[action]').forEach(el => push(el.getAttribute('action')));
    document.querySelectorAll('[data-href],[data-url],[data-link],[data-to],[to],[href]').forEach(el => {
      for (const attr of ['data-href', 'data-url', 'data-link', 'data-to', 'to', 'href']) push(el.getAttribute(attr));
    });
    document.querySelectorAll('[onclick],[x-on\\:click],[data-route],[data-path]').forEach(el => {
      for (const attr of ['onclick', 'x-on:click', 'data-route', 'data-path']) push(el.getAttribute(attr));
    });
    return [...found];
  });

  const clean = [];
  for (const href of links) {
    try {
      const routeText = href.includes('/') && !/^https?:\/\//i.test(href) ? routeStringsFromText(href, baseUrl, 'app-data') : [];
      for (const item of routeText) clean.push(item.url);
      const url = new URL(href, currentUrl);
      url.hash = '';
      const normal = cleanQueryForAudit(url.href);
      if (!shouldSkipUrl(normal, base.origin, includeList, excludeList)) clean.push(canonicaliseAuditUrl(normal));
    } catch {}
  }

  const appRoutes = await harvestAppRouteCandidates(page, baseUrl, includeList, excludeList).catch(() => []);
  for (const item of appRoutes) clean.push(item.url);

  return [...new Set(clean)];
}

async function fetchText(request, url, timeout = 12000) {
  try {
    const response = await request.get(url, { timeout });
    if (!response.ok()) return null;
    const body = await response.body();
    const buffer = Buffer.isBuffer(body) ? body : Buffer.from(body);
    if (/\.gz(?:$|[?#])/i.test(url)) {
      try { return gunzipSync(buffer).toString('utf8'); } catch { return buffer.toString('utf8'); }
    }
    return buffer.toString('utf8');
  } catch {
    return null;
  }
}

function locsFromXml(xml) {
  return [...String(xml || '').matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi)].map(m => decodeXmlText(m[1])).filter(Boolean);
}

async function sitemapUrlsFromRobots(request, baseUrl) {
  const base = new URL(baseUrl);
  const robotsUrl = `${base.origin}/robots.txt`;
  const txt = await fetchText(request, robotsUrl);
  if (!txt) return [];
  return txt.split(/\r?\n/).map(line => line.trim()).filter(line => /^sitemap\s*:/i.test(line)).map(line => line.replace(/^sitemap\s*:/i, '').trim()).map(value => {
    try { return new URL(value, base.origin).href; } catch { return ''; }
  }).filter(Boolean);
}

async function collectSitemapCandidates(request, baseUrl, options, maxSitemaps = 35) {
  const base = new URL(baseUrl);
  const discoveredSitemaps = [`${base.origin}/sitemap.xml`, `${base.origin}/sitemap_index.xml`, `${base.origin}/sitemap-index.xml`, `${base.origin}/sitemap/sitemap.xml`, `${base.origin}/wp-sitemap.xml`, ...(await sitemapUrlsFromRobots(request, baseUrl))];
  const queue = [...new Set(discoveredSitemaps)];
  const visited = new Set();
  const candidates = [];
  const diagnostics = { sitemapsTried: [], sitemapsWithLocs: [], nestedSitemaps: [], urlsFound: 0, urlsRejected: 0 };

  while (queue.length && visited.size < maxSitemaps && candidates.length < options.maxPages * 5) {
    const sitemapUrl = queue.shift();
    if (!sitemapUrl || visited.has(sitemapUrl)) continue;
    visited.add(sitemapUrl);
    diagnostics.sitemapsTried.push(sitemapUrl);
    const xml = await fetchText(request, sitemapUrl);
    if (!xml) continue;
    const locs = locsFromXml(xml);
    if (locs.length) diagnostics.sitemapsWithLocs.push({ url: sitemapUrl, locs: locs.length });
    for (const loc of locs) {
      try {
        const locUrl = new URL(loc, base.origin);
        const path = locUrl.pathname.toLowerCase();
        if ((path.endsWith('.xml') || path.endsWith('.xml.gz')) && locUrl.origin === base.origin) {
          if (!visited.has(locUrl.href) && !queue.includes(locUrl.href)) {
            queue.push(locUrl.href);
            diagnostics.nestedSitemaps.push(locUrl.href);
          }
          continue;
        }
        const clean = cleanQueryForAudit(locUrl.href);
        if (!shouldSkipUrl(clean, base.origin, options.includeList, options.excludeList)) {
          diagnostics.urlsFound += 1;
          candidates.push(discoveryCandidate(clean, `sitemap:${new URL(sitemapUrl).pathname}`, 0));
        } else {
          diagnostics.urlsRejected += 1;
        }
      } catch {
        diagnostics.urlsRejected += 1;
      }
    }
  }
  return { candidates: uniqueCandidates(candidates, baseUrl), diagnostics };
}

async function crawlCandidates(browser, options, startUrls = []) {
  const target = new URL(options.url);
  const seed = startUrls.length ? startUrls : [target.href];
  const discovered = new Map();
  const queue = seed.map(url => ({ url: canonicaliseAuditUrl(url), depth: 0 }));
  const diagnostics = { pagesCrawled: 0, linksFound: 0, bundleRoutesFound: 0, failed: [], seedCount: queue.length };
  for (const item of queue) discovered.set(item.url, discoveryCandidate(item.url, 'crawl-seed', 0));
  const crawlPage = await browser.newPage();

  while (queue.length && discovered.size <= options.maxPages * 5) {
    const current = queue.shift();
    if (!current || current.depth > options.depth) continue;
    try {
      console.log(`Crawling ${current.url}`);
      await crawlPage.goto(current.url, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await waitForPage(crawlPage, 400);
      await revealNavigationControls(crawlPage);
      const links = await collectLinks(crawlPage, options.url, options.includeList, options.excludeList);
      const appRoutes = await harvestAppRouteCandidates(crawlPage, options.url, options.includeList, options.excludeList).catch(() => []);
      diagnostics.pagesCrawled += 1;
      diagnostics.linksFound += links.length;
      diagnostics.bundleRoutesFound += appRoutes.length;
      for (const link of [...links, ...appRoutes.map(item => item.url)]) {
        if (discovered.size >= options.maxPages * 5) break;
        if (!discovered.has(link)) {
          const fromBundle = appRoutes.some(item => item.url === link);
          discovered.set(link, discoveryCandidate(link, fromBundle ? 'bundle-route' : current.depth === 0 ? 'homepage-link' : 'crawl-link', current.depth + 1));
          queue.push({ url: link, depth: current.depth + 1 });
        }
      }
    } catch (error) {
      diagnostics.failed.push({ url: current.url, reason: error.message });
      console.warn(`Could not crawl ${current.url}: ${error.message}`);
    }
  }

  await crawlPage.close().catch(() => {});
  return { candidates: uniqueCandidates([...discovered.values()], options.url), diagnostics };
}

export async function discoverPageCandidates(browser, options) {
  const mode = options.scopeMode || (options.pageList?.length ? 'exact' : 'crawl');
  const rejected = [];
  let candidates = [];
  const diagnostics = { mode, sitemap: null, crawl: null, common: null };

  if (mode === 'exact' && options.pageList.length) candidates = options.pageList.map(page => discoveryCandidate(page, 'manual', 0));
  else if (mode === 'sitemap') {
    const page = await browser.newPage();
    try {
      const sitemap = await collectSitemapCandidates(page.request, options.url, options);
      diagnostics.sitemap = sitemap.diagnostics;
      candidates = sitemap.candidates;
    } finally {
      await page.close().catch(() => {});
    }
    if (!candidates.length) rejected.push({ url: `${new URL(options.url).origin}/sitemap.xml`, source: 'sitemap', included: false, status: 0, reason: 'No sitemap URLs found' });
  } else if (mode === 'auto') {
    const page = await browser.newPage();
    let sitemap;
    try {
      sitemap = await collectSitemapCandidates(page.request, options.url, options);
      diagnostics.sitemap = sitemap.diagnostics;
    } finally {
      await page.close().catch(() => {});
    }
    const common = buildCommonRouteCandidates(options.url, options);
    const htmlSitemapSeeds = buildHtmlSitemapSeeds(options.url, options);
    const sitemapSeeds = sitemap.candidates.slice(0, 10).map(item => item.url);
    const crawl = await crawlCandidates(browser, options, [options.url, ...sitemapSeeds, ...htmlSitemapSeeds]);
    diagnostics.crawl = crawl.diagnostics;
    diagnostics.common = { candidates: common.length, htmlSitemapSeeds: htmlSitemapSeeds.length, commonRoutesTried: COMMON_PUBLIC_ROUTES.length };
    candidates = uniqueCandidates([...sitemap.candidates, ...crawl.candidates, ...common], options.url);
  } else {
    const crawl = await crawlCandidates(browser, options, [options.url]);
    diagnostics.crawl = crawl.diagnostics;
    candidates = crawl.candidates;
  }

  candidates = uniqueCandidates(candidates, options.url).slice(0, Math.max(options.maxPages * 3, options.maxPages));
  console.log(`Validating ${candidates.length} discovered page candidate(s)...`);
  const validated = await validateCandidates(browser, options, candidates);
  const included = validated.included;
  const allRejected = [...rejected, ...validated.rejected];
  return { mode, included, rejected: allRejected, diagnostics, summary: { candidates: candidates.length, included: included.length, rejected: allRejected.length, sources: Object.keys(sourceCounts(included)) }, quality: discoveryQuality({ mode, included, rejected: allRejected, diagnostics }) };
}

export async function discoverPages(browser, options) {
  if (options.pageList.length) {
    const resolved = [];
    for (const rawPage of options.pageList) resolved.push(await resolveExplicitPage(browser, options, rawPage));
    const selected = [...new Set(resolved)].slice(0, options.maxPages);
    console.log(`Using ${selected.length} reviewed/manual page(s) supplied by the UI.`);
    return selected;
  }
  const discovery = await discoverPageCandidates(browser, options);
  if (!discovery.included.length) {
    console.log(`No valid pages discovered for ${options.url}; falling back to target URL.`);
    return [canonicaliseAuditUrl(options.url)];
  }
  for (const item of discovery.included) if (item.requestedUrl !== item.url) console.log(`Using ${item.url} (${item.source}; ${item.reason})`);
  if (discovery.rejected.length) console.log(`Rejected ${discovery.rejected.length} invalid/duplicate/non-auditable URL(s).`);
  if (discovery.quality?.message) console.log(discovery.quality.message);
  for (const recommendation of discovery.quality?.recommendations || []) console.log(`Discovery recommendation: ${recommendation}`);
  return discovery.included.map(item => item.url).slice(0, options.maxPages);
}
