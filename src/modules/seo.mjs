import { makeIssue } from '../core/issues.mjs';

export async function runSeoModule(page, url) {
  const data = await page.evaluate(() => {
    const meta = name => document.querySelector(`meta[name="${name}"]`)?.getAttribute('content') || '';
    const prop = name => document.querySelector(`meta[property="${name}"]`)?.getAttribute('content') || '';
    const jsonLd = [...document.querySelectorAll('script[type="application/ld+json"]')].map(s => s.textContent || '');
    const headings = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].map(h => ({ level: Number(h.tagName.slice(1)), tag: h.tagName, text: h.innerText.trim().slice(0, 140) }));
    return {
      title: document.title || '',
      description: meta('description'),
      canonical: document.querySelector('link[rel="canonical"]')?.href || '',
      h1s: [...document.querySelectorAll('h1')].map(h => h.innerText.trim()).filter(Boolean),
      headings,
      ogTitle: prop('og:title'),
      ogDescription: prop('og:description'),
      ogImage: prop('og:image'),
      twitterCard: meta('twitter:card'),
      robots: meta('robots'),
      jsonLd
    };
  });
  const issues = [];
  const add = obj => issues.push(makeIssue({ module: 'seo', category: 'SEO', url, ...obj }));

  if (!data.title) add({ severity: 'High', title: 'Missing page title', description: 'The page does not have a document title.', recommendation: 'Add a unique, descriptive title tag.' });
  else if (data.title.length < 18) add({ severity: 'Medium', title: 'Page title is too short', description: 'The title may not describe the page clearly enough.', evidence: data.title, recommendation: 'Use a clear title of roughly 30 to 60 characters.' });
  else if (data.title.length > 70) add({ severity: 'Low', title: 'Page title is long', description: 'The title may be truncated in search results.', evidence: data.title, recommendation: 'Shorten the title while preserving the primary keyword/topic.' });

  if (!data.description) add({ severity: 'High', title: 'Missing meta description', description: 'The page has no meta description.', recommendation: 'Add a concise meta description for search previews.' });
  else if (data.description.length < 70) add({ severity: 'Medium', title: 'Meta description is short', description: 'The description may not give enough context.', evidence: data.description, recommendation: 'Use a fuller description of roughly 120 to 160 characters.' });
  else if (data.description.length > 170) add({ severity: 'Low', title: 'Meta description is long', description: 'The description may be truncated.', evidence: data.description, recommendation: 'Shorten to around 120 to 160 characters.' });

  if (!data.canonical) add({ severity: 'Medium', title: 'Missing canonical URL', description: 'No canonical link was found.', recommendation: 'Add a canonical URL to clarify the preferred indexed page.' });
  if (!data.h1s.length) add({ severity: 'High', title: 'Missing H1', description: 'The page has no H1 heading.', recommendation: 'Add one clear H1 describing the page.' });
  if (data.h1s.length > 1) add({ severity: 'Medium', title: 'Multiple H1 headings', description: 'The page has more than one H1 heading.', evidence: data.h1s.join(' | '), recommendation: 'Use one primary H1 and demote secondary headings to H2/H3.' });

  let last = 0;
  for (const h of data.headings) {
    if (last && h.level > last + 1) {
      add({ severity: 'Low', title: 'Heading level jump', description: 'The heading structure jumps levels, which can reduce clarity.', evidence: `${h.tag}: ${h.text}`, recommendation: 'Use a logical heading structure without skipping levels.' });
      break;
    }
    last = h.level;
  }

  if (!data.ogTitle || !data.ogDescription || !data.ogImage) add({ severity: 'Low', title: 'Incomplete Open Graph metadata', description: 'One or more Open Graph tags are missing.', evidence: `og:title=${!!data.ogTitle}, og:description=${!!data.ogDescription}, og:image=${!!data.ogImage}`, recommendation: 'Add complete Open Graph metadata for social sharing.' });
  if (!data.twitterCard) add({ severity: 'Low', title: 'Missing Twitter/X card metadata', description: 'No twitter:card meta tag was found.', recommendation: 'Add Twitter/X card metadata if social sharing matters.' });
  if (/noindex/i.test(data.robots)) add({ severity: 'High', title: 'Page set to noindex', description: 'The page has a robots noindex directive.', evidence: data.robots, recommendation: 'Confirm this is intentional for public pages.' });

  for (const script of data.jsonLd) {
    try { JSON.parse(script); }
    catch { add({ severity: 'Medium', title: 'Invalid JSON-LD', description: 'Structured data could not be parsed as JSON.', evidence: script.slice(0, 160), recommendation: 'Validate and correct JSON-LD.' }); }
  }
  return { data, issues };
}

export async function runSiteSeoChecks(request, baseUrl) {
  const issues = [];
  const base = new URL(baseUrl);
  for (const file of ['/robots.txt', '/sitemap.xml']) {
    try {
      const url = new URL(file, base.origin).href;
      const res = await request.get(url, { timeout: 10000 });
      if (res.status() >= 400) issues.push(makeIssue({ module: 'seo', category: 'SEO', severity: file === '/sitemap.xml' ? 'Medium' : 'Low', title: `${file} not found`, description: `${file} returned ${res.status()}.`, url, recommendation: `Add or verify ${file} if search engines need clear crawl guidance.`, confidence: 'Medium' }));
    } catch {
      issues.push(makeIssue({ module: 'seo', category: 'SEO', severity: 'Low', title: `${file} check failed`, description: `Could not check ${file}.`, url: new URL(file, base.origin).href, recommendation: 'Check site routing and availability.', confidence: 'Low' }));
    }
  }
  return issues;
}
