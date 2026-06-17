import fs from 'node:fs/promises';
import path from 'node:path';
import { makeIssue } from '../core/issues.mjs';

async function runAxeIfAvailable(page, url) {
  try {
    const axePath = path.resolve('node_modules', 'axe-core', 'axe.min.js');
    const source = await fs.readFile(axePath, 'utf8');
    await page.addScriptTag({ content: source });
    const results = await page.evaluate(async () => await window.axe.run(document, { resultTypes: ['violations'] }));
    return results.violations.slice(0, 100).map(v => makeIssue({
      module: 'accessibility',
      category: 'Accessibility',
      severity: v.impact === 'critical' ? 'Critical' : v.impact === 'serious' ? 'High' : v.impact === 'moderate' ? 'Medium' : 'Low',
      title: `Axe: ${v.help}`,
      description: v.description,
      url,
      evidence: v.nodes.slice(0, 6).map(n => n.target.join(', ')).join(' | '),
      selector: v.nodes?.[0]?.target?.join(', ') || '',
      recommendation: v.helpUrl || 'Review the affected elements and apply WCAG guidance.',
      confidence: 'High',
      tags: v.tags || []
    }));
  } catch {
    return [];
  }
}

export async function runAccessibilityModule(page, url) {
  const data = await page.evaluate(() => {
    function rgbParts(value) {
      const m = String(value).match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
      return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
    }
    function luminance(rgb) {
      const vals = rgb.map(v => {
        v /= 255;
        return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
      });
      return 0.2126 * vals[0] + 0.7152 * vals[1] + 0.0722 * vals[2];
    }
    function contrast(a, b) {
      const l1 = luminance(a);
      const l2 = luminance(b);
      return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    }
    function effectiveBg(el) {
      let node = el;
      while (node && node !== document.documentElement) {
        const bg = getComputedStyle(node).backgroundColor;
        if (bg && !/rgba\(0,\s*0,\s*0,\s*0\)|transparent/i.test(bg)) return bg;
        node = node.parentElement;
      }
      return getComputedStyle(document.body).backgroundColor || 'rgb(255,255,255)';
    }

    const missingAlt = [...document.querySelectorAll('img')].filter(img => !img.hasAttribute('alt')).map(img => img.src || img.outerHTML.slice(0, 90)).slice(0, 60);
    const emptyButtons = [...document.querySelectorAll('button')].filter(btn => !(btn.innerText || btn.getAttribute('aria-label') || btn.getAttribute('title') || '').trim()).map(btn => btn.outerHTML.slice(0, 140)).slice(0, 40);
    const emptyLinks = [...document.querySelectorAll('a[href]')].filter(a => !(a.innerText || a.getAttribute('aria-label') || a.getAttribute('title') || '').trim()).map(a => a.href).slice(0, 40);
    const inputsMissingLabels = [...document.querySelectorAll('input, select, textarea')].filter(input => {
      if (input.type === 'hidden') return false;
      if (input.getAttribute('aria-label') || input.getAttribute('aria-labelledby')) return false;
      if (input.id && document.querySelector(`label[for="${CSS.escape(input.id)}"]`)) return false;
      if (input.closest('label')) return false;
      return true;
    }).map(input => ({ tag: input.tagName.toLowerCase(), type: input.getAttribute('type') || '', placeholder: input.getAttribute('placeholder') || '', id: input.id || '' })).slice(0, 60);
    const landmarks = [...document.querySelectorAll('main, nav, header, footer, aside, [role="main"], [role="navigation"], [role="banner"], [role="contentinfo"]')].length;
    const positiveTabIndex = [...document.querySelectorAll('[tabindex]')].filter(el => Number(el.getAttribute('tabindex')) > 0).map(el => el.outerHTML.slice(0, 120)).slice(0, 30);
    const noSkipLink = ![...document.querySelectorAll('a[href^="#"]')].some(a => /skip/i.test(a.innerText || a.getAttribute('aria-label') || ''));
    const controlsMissingAutocomplete = [...document.querySelectorAll('input')].filter(input => {
      const type = (input.type || '').toLowerCase();
      return ['email', 'tel', 'name', 'text', 'password'].includes(type) && !input.getAttribute('autocomplete') && /email|phone|tel|name|password|address/i.test(`${input.name || ''} ${input.id || ''} ${input.placeholder || ''}`);
    }).map(input => input.outerHTML.slice(0, 140)).slice(0, 30);

    const contrastProblems = [...document.querySelectorAll('body *')].map(el => {
      const text = (el.innerText || '').trim();
      if (!text || text.length > 180) return null;
      const rect = el.getBoundingClientRect();
      if (rect.width < 10 || rect.height < 8 || rect.top > window.innerHeight * 3) return null;
      const style = getComputedStyle(el);
      const fg = rgbParts(style.color);
      const bg = rgbParts(effectiveBg(el));
      if (!fg || !bg) return null;
      const ratio = contrast(fg, bg);
      const fontSize = parseFloat(style.fontSize || '16');
      const threshold = fontSize >= 18 ? 3 : 4.5;
      if (ratio < threshold) {
        return { text: text.slice(0, 80), ratio: Math.round(ratio * 100) / 100, selector: el.id ? `#${el.id}` : el.className ? `.${String(el.className).split(/\s+/).filter(Boolean)[0]}` : el.tagName.toLowerCase() };
      }
      return null;
    }).filter(Boolean).slice(0, 30);

    return { missingAlt, emptyButtons, emptyLinks, inputsMissingLabels, landmarks, positiveTabIndex, noSkipLink, controlsMissingAutocomplete, contrastProblems };
  });

  const issues = [];
  const add = obj => issues.push(makeIssue({ module: 'accessibility', category: 'Accessibility', url, ...obj }));

  if (data.missingAlt.length) add({ severity: 'Medium', title: 'Images missing alt attributes', description: 'Some images do not have alt attributes.', evidence: `${data.missingAlt.length} examples.`, recommendation: 'Add meaningful alt text or alt="" for decorative images.' });
  if (data.emptyButtons.length) add({ severity: 'High', title: 'Buttons without accessible names', description: 'Some buttons have no text or accessible label.', evidence: `${data.emptyButtons.length} examples.`, recommendation: 'Add visible text or aria-label to icon-only buttons.' });
  if (data.emptyLinks.length) add({ severity: 'High', title: 'Links without accessible names', description: 'Some links have no text or accessible label.', evidence: `${data.emptyLinks.length} examples.`, recommendation: 'Add link text or aria-label.' });
  if (data.inputsMissingLabels.length) add({ severity: 'High', title: 'Form fields missing labels', description: 'Some form controls are not associated with labels.', evidence: JSON.stringify(data.inputsMissingLabels.slice(0, 8)), recommendation: 'Associate each field with a label, aria-label or aria-labelledby.' });
  if (!data.landmarks) add({ severity: 'Medium', title: 'No semantic landmarks found', description: 'No page landmarks were found.', recommendation: 'Use header, nav, main and footer landmarks.' });
  if (data.positiveTabIndex.length) add({ severity: 'Medium', title: 'Positive tabindex values found', description: 'Positive tabindex values can create confusing keyboard navigation order.', evidence: `${data.positiveTabIndex.length} examples.`, recommendation: 'Use natural DOM order and avoid tabindex values greater than 0.' });
  if (data.noSkipLink) add({ severity: 'Low', title: 'No skip link detected', description: 'No obvious skip-to-content link was detected.', recommendation: 'Add a visible-on-focus skip link to improve keyboard navigation.' });
  if (data.controlsMissingAutocomplete.length) add({ severity: 'Low', title: 'Form fields may be missing autocomplete attributes', description: 'Some personal-detail fields may not provide autocomplete hints.', evidence: `${data.controlsMissingAutocomplete.length} examples.`, recommendation: 'Add appropriate autocomplete attributes to common personal-detail fields.' });
  if (data.contrastProblems.length) add({ severity: 'Medium', title: 'Potential colour contrast problems', description: 'Some text/background combinations may not meet recommended contrast thresholds.', evidence: JSON.stringify(data.contrastProblems.slice(0, 10)), recommendation: 'Review text colours against their backgrounds and target WCAG AA contrast levels.' });

  issues.push(...await runAxeIfAvailable(page, url));
  return { data, issues };
}
