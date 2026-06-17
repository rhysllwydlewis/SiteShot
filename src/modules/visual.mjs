import { makeIssue } from '../core/issues.mjs';

export async function runVisualModule(page, url, context, screenshot = '') {
  const data = await page.evaluate(({ flags, budgets }) => {
    const viewportWidth = window.innerWidth;
    const body = document.body;
    const doc = document.documentElement;
    const scrollWidth = Math.max(body?.scrollWidth || 0, doc?.scrollWidth || 0);
    const maxOverflow = Number(budgets.maxHorizontalOverflowPx ?? 8);
    const minTap = Number(budgets.minTapTargetPx ?? 40);
    const visibleText = body?.innerText || '';
    const flagHits = flags.filter(flag => flag && visibleText.toLowerCase().includes(flag.toLowerCase()));

    const widestElements = [...document.querySelectorAll('body *')].map(el => {
      const rect = el.getBoundingClientRect();
      if (!rect.width || rect.width <= viewportWidth + maxOverflow) return null;
      const selector = el.id ? `#${el.id}` : el.className ? `.${String(el.className).split(/\s+/).filter(Boolean).slice(0, 3).join('.')}` : el.tagName.toLowerCase();
      return { selector, width: Math.round(rect.width), left: Math.round(rect.left), right: Math.round(rect.right) };
    }).filter(Boolean).slice(0, 25);

    const tapTargets = [...document.querySelectorAll('a[href], button, input, select, textarea, [role="button"]')].map(el => {
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      if (!(rect.width > 0 && rect.height > 0) || style.display === 'none' || style.visibility === 'hidden') return null;
      if (rect.top > window.innerHeight || rect.bottom < 0) return null;
      if (rect.width < minTap || rect.height < minTap) {
        return {
          tag: el.tagName.toLowerCase(),
          selector: el.id ? `#${el.id}` : el.className ? `.${String(el.className).split(/\s+/).filter(Boolean)[0]}` : el.tagName.toLowerCase(),
          text: (el.innerText || el.getAttribute('aria-label') || el.getAttribute('placeholder') || '').trim().slice(0, 80),
          width: Math.round(rect.width),
          height: Math.round(rect.height)
        };
      }
      return null;
    }).filter(Boolean).slice(0, 40);

    const fixedElements = [...document.querySelectorAll('body *')].filter(el => ['fixed', 'sticky'].includes(window.getComputedStyle(el).position)).map(el => {
      const rect = el.getBoundingClientRect();
      return { tag: el.tagName.toLowerCase(), text: (el.innerText || '').trim().slice(0, 80), width: Math.round(rect.width), height: Math.round(rect.height) };
    }).slice(0, 30);

    return {
      title: document.title || '',
      h1: document.querySelector('h1')?.innerText?.trim() || '',
      viewportWidth,
      scrollWidth,
      hasHorizontalOverflow: scrollWidth > viewportWidth + maxOverflow,
      widestElements,
      tapTargets,
      flagHits,
      fixedElements,
      pageHeight: Math.max(body?.scrollHeight || 0, doc?.scrollHeight || 0)
    };
  }, { flags: context.flagText || [], budgets: context.budgets || {} });

  const issues = [];
  if (data.hasHorizontalOverflow) issues.push(makeIssue({ module: 'visual', category: 'Mobile UX', severity: 'High', title: 'Horizontal overflow detected', description: 'The page is wider than the viewport and can cause sideways scrolling on mobile.', url, evidence: `Viewport ${data.viewportWidth}px, document width ${data.scrollWidth}px. Widest: ${data.widestElements?.[0]?.selector || 'unknown'}`, selector: data.widestElements?.[0]?.selector || '', screenshot, recommendation: 'Audit the widest element and remove fixed widths, oversized tables, absolute positioning or uncontained carousels.', confidence: 'High', impact: 'Poor mobile usability and perceived quality.' }));
  for (const target of data.tapTargets || []) issues.push(makeIssue({ module: 'visual', category: 'Mobile UX', severity: 'Medium', title: 'Small tap target', description: 'An interactive element is smaller than the recommended touch size.', url, evidence: `${target.tag} "${target.text || '(no text)'}" is ${target.width}x${target.height}px.`, selector: target.selector, screenshot, recommendation: 'Increase target size and spacing, especially for mobile controls.', confidence: 'Medium' }));
  for (const flag of data.flagHits || []) issues.push(makeIssue({ module: 'visual', category: 'Content / Trust', severity: 'High', title: 'Flagged public text found', description: 'Configured flagged text was found in visible page content.', url, evidence: flag, screenshot, recommendation: 'Remove internal, test or unwanted text from public output.', confidence: 'High' }));
  if (data.pageHeight > (context.budgets?.maxPageHeight || 12000)) issues.push(makeIssue({ module: 'visual', category: 'Mobile UX', severity: 'Low', title: 'Very long page', description: 'The page is unusually long and may feel difficult to review on mobile.', url, evidence: `${data.pageHeight}px page height.`, screenshot, recommendation: 'Use clearer content grouping, section navigation, accordions or step-based flows.', confidence: 'Medium' }));
  return { data, issues };
}
