import { makeIssue } from '../core/issues.mjs';

export async function runPerformanceModule(page, url, networkLog, budgets = {}) {
  const data = await page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0];
    const paint = performance.getEntriesByType('paint').reduce((acc, p) => ({ ...acc, [p.name]: Math.round(p.startTime) }), {});
    const lcpEntries = performance.getEntriesByType('largest-contentful-paint');
    const layoutShiftEntries = performance.getEntriesByType('layout-shift').filter(e => !e.hadRecentInput);
    const resources = performance.getEntriesByType('resource').map(r => ({
      name: r.name,
      initiatorType: r.initiatorType,
      duration: Math.round(r.duration),
      transferSize: r.transferSize || 0,
      encodedBodySize: r.encodedBodySize || 0,
      renderBlockingStatus: r.renderBlockingStatus || ''
    })).sort((a,b) => (b.transferSize || b.encodedBodySize) - (a.transferSize || a.encodedBodySize)).slice(0, 250);

    const totalTransfer = resources.reduce((sum, r) => sum + (r.transferSize || r.encodedBodySize || 0), 0);
    const renderBlocking = resources.filter(r => r.renderBlockingStatus === 'blocking').slice(0, 30);
    const thirdParty = resources.filter(r => {
      try { return new URL(r.name).origin !== location.origin; } catch { return false; }
    }).slice(0, 80);

    return {
      domContentLoaded: nav ? Math.round(nav.domContentLoadedEventEnd) : null,
      loadEventEnd: nav ? Math.round(nav.loadEventEnd) : null,
      ttfb: nav ? Math.round(nav.responseStart) : null,
      fcp: paint['first-contentful-paint'] || null,
      lcp: lcpEntries.length ? Math.round(lcpEntries[lcpEntries.length - 1].startTime) : null,
      cls: Math.round(layoutShiftEntries.reduce((sum, e) => sum + e.value, 0) * 1000) / 1000,
      resourceCount: performance.getEntriesByType('resource').length,
      resources,
      thirdPartyCount: thirdParty.length,
      thirdParty,
      renderBlocking,
      totalTransfer,
      domNodes: document.querySelectorAll('*').length,
      pageHeight: Math.max(document.body?.scrollHeight || 0, document.documentElement?.scrollHeight || 0)
    };
  });

  const issues = [];
  const add = obj => issues.push(makeIssue({ module: 'performance', category: 'Performance', url, ...obj }));

  if (data.ttfb && data.ttfb > 800) add({ severity: 'Medium', title: 'Slow server response / TTFB', description: 'The browser observed a slow time to first byte.', evidence: `${data.ttfb}ms`, recommendation: 'Review server response time, hosting, caching and backend work before first byte.' });
  if (data.fcp && data.fcp > 1800) add({ severity: 'Medium', title: 'Slow First Contentful Paint', description: 'First Contentful Paint appears slower than ideal.', evidence: `${data.fcp}ms`, recommendation: 'Optimise render blocking resources, server response and critical CSS/JS.' });
  if (data.lcp && data.lcp > 2500) add({ severity: 'High', title: 'Slow Largest Contentful Paint', description: 'The largest visible content element appears late.', evidence: `${data.lcp}ms`, recommendation: 'Optimise hero imagery, server response, critical CSS, fonts and client-side rendering.' });
  if (data.cls && data.cls > 0.1) add({ severity: 'Medium', title: 'Layout shift detected', description: 'Cumulative Layout Shift is above a sensible threshold.', evidence: `CLS ${data.cls}`, recommendation: 'Reserve image/media dimensions, avoid late-injected banners and stabilise font loading.' });
  if (data.resourceCount > (budgets.maxRequests || 120)) add({ severity: 'Medium', title: 'High number of requests', description: 'The page makes a large number of resource requests.', evidence: `${data.resourceCount} resources.`, recommendation: 'Review third-party scripts, duplicate assets and bundling opportunities.' });
  if (data.totalTransfer > (budgets.maxTransferBytes || 3500000)) add({ severity: 'Medium', title: 'High total transfer size', description: 'The page transfers a large amount of data.', evidence: `${Math.round(data.totalTransfer / 1024)} KB transferred.`, recommendation: 'Optimise images, fonts, JavaScript and CSS payloads.' });
  if (data.domNodes > (budgets.maxDomNodes || 2500)) add({ severity: 'Medium', title: 'Large DOM size', description: 'The DOM is large and may affect rendering performance.', evidence: `${data.domNodes} DOM nodes.`, recommendation: 'Reduce repeated markup, hidden panels and heavy client-side rendering.' });
  if (data.pageHeight > (budgets.maxPageHeight || 12000)) add({ severity: 'Low', title: 'Very long page height', description: 'The page is very long and may be heavy to render.', evidence: `${data.pageHeight}px page height.`, recommendation: 'Use progressive disclosure, shorter sections or pagination where appropriate.' });

  const large = data.resources.filter(r => {
    const size = r.transferSize || r.encodedBodySize || 0;
    if (r.initiatorType === 'img') return size > (budgets.largeImageBytes || 500000);
    if (r.initiatorType === 'script') return size > (budgets.largeScriptBytes || 750000);
    if (r.initiatorType === 'css' || r.initiatorType === 'link') return size > (budgets.largeCssBytes || 250000);
    return false;
  }).slice(0, 20);
  if (large.length) add({ severity: 'Medium', title: 'Large assets detected', description: 'Some assets are large and may slow the page.', evidence: large.map(r => `${r.initiatorType} ${(r.transferSize || r.encodedBodySize)} ${r.name}`).join('\n'), recommendation: 'Optimise images, split large scripts and remove unused CSS/JS.' });

  const slow = data.resources.filter(r => r.duration > 1500).slice(0, 20);
  if (slow.length) add({ severity: 'Low', title: 'Slow resource loads', description: 'Some resources took a long time to load.', evidence: slow.map(r => `${r.duration}ms ${r.name}`).join('\n'), recommendation: 'Investigate slow third-party resources and server response times.' });

  if (data.renderBlocking.length) add({ severity: 'Low', title: 'Render blocking resources detected', description: 'Some resources are reported as render blocking.', evidence: data.renderBlocking.map(r => r.name).slice(0, 10).join('\n'), recommendation: 'Review critical CSS/JS and defer non-critical resources where possible.' });
  if (data.thirdPartyCount > 25) add({ severity: 'Low', title: 'High number of third-party resources', description: 'The page loads many third-party resources.', evidence: `${data.thirdPartyCount} third-party resources.`, recommendation: 'Review whether all third-party scripts and assets are required.' });

  return { data, issues };
}
