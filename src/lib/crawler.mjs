import { normalisePageUrl, shouldSkipUrl, canonicaliseAuditUrl, withTrailingSlash, cleanQueryForAudit } from './utils.mjs';

export async function waitForPage(page, waitMs) {
  await page.waitForLoadState('domcontentloaded', { timeout: 45000 }).catch(() => {});
  await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
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

function discoveryCandidate(url, source, depth = 0) {
  return { url: canonicaliseAuditUrl(cleanQueryForAudit(url)), source, depth };
}

function uniqueCandidates(candidates) {
  const seen = new Map();
  for (const item of candidates) {
    if (!item?.url) continue;
    if (!seen.has(item.url)) seen.set(item.url, item);
  }
  return [...seen.values()];
}

async function tryRoute(page, url) {
  try {
    const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await waitForPage(page, 250);
    const status = response?.status() ?? 0;
    const notFoundLike = await looksLikeNotFoundPage(page);
    return {
      requestedUrl: url,
      finalUrl: canonicaliseAuditUrl(page.url()),
      status,
      ok: status > 0 && status < 400 && !notFoundLike,
      notFoundLike,
      reason: status >= 400 ? `HTTP ${status}` : notFoundLike ? 'Visible not-found page' : 'OK'
    };
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
      if (result.ok) {
        return {
          url: result.finalUrl,
          requestedUrl: candidate.url,
          status: result.status,
          source: candidate.source,
          depth: candidate.depth,
          included: true,
          reason: result.finalUrl !== canonical ? `Resolved to ${result.finalUrl}` : 'OK'
        };
      }
    }

    const best = attempts.find(a => a.status && a.status < 500) || attempts[0] || {};
    return {
      url: best.finalUrl || canonical,
      requestedUrl: candidate.url,
      status: best.status || 0,
      source: candidate.source,
      depth: candidate.depth,
      included: false,
      reason: best.reason || best.error || 'Route did not validate'
    };
  } finally {
    await page.close().catch(() => {});
  }
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
    try {
      handles = await page.$$(selector);
    } catch {
      continue;
    }

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

export async function collectLinks(page, baseUrl, includeList, excludeList) {
  const base = new URL(baseUrl);

  const links = await page.evaluate(() => {
    const found = new Set();

    const push = value => {
      if (!value || typeof value !== 'string') return;
      const trimmed = value.trim();
      if (!trimmed || trimmed === '#' || trimmed.startsWith('javascript:') || trimmed.startsWith('mailto:') || trimmed.startsWith('tel:')) return;
      found.add(trimmed);
    };

    document.querySelectorAll('a[href],area[href]').forEach(el => push(el.getAttribute('href') || el.href));
    document.querySelectorAll('[data-href],[data-url],[data-link],[data-to],[to],[href]').forEach(el => {
      for (const attr of ['data-href','data-url','data-link','data-to','to','href']) push(el.getAttribute(attr));
    });

    for (const script of [...document.scripts].slice(0, 30)) {
      const text = script.textContent || '';
      const matches = text.match(/https?:\/\/[^"'\\\s<>]+|\/[A-Za-z0-9][^"'\\\s<>]{1,160}/g) || [];
      for (const match of matches.slice(0, 200)) push(match);
    }

    return [...found];
  });

  const clean = [];
  for (const href of links) {
    try {
      const url = new URL(href, base.origin);
      url.hash = '';
      const normal = cleanQueryForAudit(url.href);
      if (!shouldSkipUrl(normal, base.origin, includeList, excludeList)) clean.push(canonicaliseAuditUrl(normal));
    } catch {}
  }

  return [...new Set(clean)];
}

async function fetchText(request, url, timeout = 12000) {
  try {
    const response = await request.get(url, { timeout });
    if (!response.ok()) return null;
    return await response.text();
  } catch {
    return null;
  }
}

function locsFromXml(xml) {
  return [...String(xml || '').matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi)].map(m => m[1].trim()).filter(Boolean);
}

async function sitemapUrlsFromRobots(request, baseUrl) {
  const base = new URL(baseUrl);
  const robotsUrl = `${base.origin}/robots.txt`;
  const txt = await fetchText(request, robotsUrl);
  if (!txt) return [];
  return txt.split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => /^sitemap\s*:/i.test(line))
    .map(line => line.replace(/^sitemap\s*:/i, '').trim())
    .filter(Boolean);
}

async function collectSitemapCandidates(request, baseUrl, options, maxSitemaps = 20) {
  const base = new URL(baseUrl);
  const discoveredSitemaps = [
    `${base.origin}/sitemap.xml`,
    `${base.origin}/sitemap_index.xml`,
    ...(await sitemapUrlsFromRobots(request, baseUrl))
  ];

  const queue = [...new Set(discoveredSitemaps)];
  const visited = new Set();
  const candidates = [];

  while (queue.length && visited.size < maxSitemaps && candidates.length < options.maxPages * 3) {
    const sitemapUrl = queue.shift();
    if (!sitemapUrl || visited.has(sitemapUrl)) continue;
    visited.add(sitemapUrl);

    const xml = await fetchText(request, sitemapUrl);
    if (!xml) continue;

    const locs = locsFromXml(xml);
    for (const loc of locs) {
      try {
        const locUrl = new URL(loc);
        const path = locUrl.pathname.toLowerCase();
        if (path.endsWith('.xml') && locUrl.origin === base.origin) {
          if (!visited.has(locUrl.href)) queue.push(locUrl.href);
          continue;
        }

        const clean = cleanQueryForAudit(locUrl.href);
        if (!shouldSkipUrl(clean, base.origin, options.includeList, options.excludeList)) {
          candidates.push(discoveryCandidate(clean, `sitemap:${new URL(sitemapUrl).pathname}`, 0));
        }
      } catch {}
    }
  }

  return uniqueCandidates(candidates);
}

async function crawlCandidates(browser, options, startUrls = []) {
  const target = new URL(options.url);
  const seed = startUrls.length ? startUrls : [target.href];
  const discovered = new Map();
  const queue = seed.map(url => ({ url: canonicaliseAuditUrl(url), depth: 0 }));
  for (const item of queue) discovered.set(item.url, discoveryCandidate(item.url, 'crawl-seed', 0));

  const crawlPage = await browser.newPage();

  while (queue.length && discovered.size <= options.maxPages * 3) {
    const current = queue.shift();
    if (!current || current.depth > options.depth) continue;
    try {
      console.log(`Crawling ${current.url}`);
      await crawlPage.goto(current.url, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await waitForPage(crawlPage, 400);
      await revealNavigationControls(crawlPage);
      const links = await collectLinks(crawlPage, options.url, options.includeList, options.excludeList);
      for (const link of links) {
        if (discovered.size >= options.maxPages * 3) break;
        if (!discovered.has(link)) {
          discovered.set(link, discoveryCandidate(link, current.depth === 0 ? 'homepage-link' : 'crawl-link', current.depth + 1));
          queue.push({ url: link, depth: current.depth + 1 });
        }
      }
    } catch (error) {
      console.warn(`Could not crawl ${current.url}: ${error.message}`);
    }
  }

  await crawlPage.close().catch(() => {});
  return [...discovered.values()];
}

export async function discoverPageCandidates(browser, options) {
  const mode = options.scopeMode || (options.pageList?.length ? 'exact' : 'crawl');
  const rejected = [];
  let candidates = [];

  if (mode === 'exact' && options.pageList.length) {
    candidates = options.pageList.map(page => discoveryCandidate(page, 'manual', 0));
  } else if (mode === 'sitemap') {
    const page = await browser.newPage();
    candidates = await collectSitemapCandidates(page.request, options.url, options);
    await page.close().catch(() => {});
    if (!candidates.length) {
      rejected.push({ url: `${new URL(options.url).origin}/sitemap.xml`, source: 'sitemap', included: false, status: 0, reason: 'No sitemap URLs found' });
    }
  } else if (mode === 'auto') {
    const page = await browser.newPage();
    const sitemap = await collectSitemapCandidates(page.request, options.url, options);
    await page.close().catch(() => {});
    const crawl = await crawlCandidates(browser, options, [options.url]);
    candidates = uniqueCandidates([...sitemap, ...crawl]);
  } else {
    candidates = await crawlCandidates(browser, options, [options.url]);
  }

  candidates = uniqueCandidates(candidates).slice(0, Math.max(options.maxPages * 2, options.maxPages));
  const included = [];
  const seenIncluded = new Set();

  console.log(`Validating ${candidates.length} discovered page candidate(s)...`);

  for (const candidate of candidates) {
    if (included.length >= options.maxPages) break;
    const result = await validateCandidate(browser, options, candidate);
    if (result.included && !seenIncluded.has(result.url)) {
      included.push(result);
      seenIncluded.add(result.url);
    } else if (!result.included) {
      rejected.push(result);
    }
  }

  return {
    mode,
    included,
    rejected,
    summary: {
      candidates: candidates.length,
      included: included.length,
      rejected: rejected.length,
      sources: [...new Set([...included, ...rejected].map(item => item.source).filter(Boolean))]
    }
  };
}

export async function discoverPages(browser, options) {
  // If the UI has already supplied a reviewed/selected page list, respect it.
  // This is important for Auto Discover / Crawl / Sitemap preview flows:
  // the user may untick pages before pressing Run Audit.
  if (options.pageList.length) {
    const resolved = [];
    for (const rawPage of options.pageList) {
      resolved.push(await resolveExplicitPage(browser, options, rawPage));
    }
    const selected = [...new Set(resolved)].slice(0, options.maxPages);
    console.log(`Using ${selected.length} reviewed/manual page(s) supplied by the UI.`);
    return selected;
  }

  const discovery = await discoverPageCandidates(browser, options);
  if (!discovery.included.length) {
    console.log(`No valid pages discovered for ${options.url}; falling back to target URL.`);
    return [canonicaliseAuditUrl(options.url)];
  }

  for (const item of discovery.included) {
    if (item.requestedUrl !== item.url) console.log(`Using ${item.url} (${item.source}; ${item.reason})`);
  }
  if (discovery.rejected.length) console.log(`Rejected ${discovery.rejected.length} invalid/duplicate/non-auditable URL(s).`);

  return discovery.included.map(item => item.url).slice(0, options.maxPages);
}
