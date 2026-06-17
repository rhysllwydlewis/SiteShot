import { makeIssue } from '../core/issues.mjs';

export async function runContentModule(page, url) {
  const data = await page.evaluate(() => {
    const text = document.body?.innerText || '';
    const lower = text.toLowerCase();
    const placeholders = ['lorem ipsum', 'todo', 'placeholder', 'coming soon', 'test mode', 'sample text', 'dummy text', 'example only'].filter(p => lower.includes(p));
    const emails = [...new Set((text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || []))].slice(0, 20);
    const repeatedButtons = [...document.querySelectorAll('a,button')].map(el => (el.innerText || '').trim()).filter(Boolean).reduce((acc, txt) => { acc[txt] = (acc[txt] || 0) + 1; return acc; }, {});
    const heavyRepeats = Object.entries(repeatedButtons).filter(([txt, count]) => count >= 8 && txt.length < 40).slice(0, 20);
    const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
    return { placeholders, emails, heavyRepeats, wordCount };
  });

  const issues = [];
  const add = obj => issues.push(makeIssue({ module: 'content', category: 'Content / Trust', url, ...obj }));
  if (data.placeholders.length) add({ severity: 'High', title: 'Placeholder/test content found', description: 'The page appears to include placeholder or test content.', evidence: data.placeholders.join(', '), recommendation: 'Remove placeholder/test text from production pages.' });
  if (data.heavyRepeats.length) add({ severity: 'Low', title: 'Repeated CTA/link text', description: 'The same button or link text appears many times, which may reduce clarity.', evidence: JSON.stringify(data.heavyRepeats), recommendation: 'Make repeated CTAs more specific where possible.' });
  if (data.wordCount < 80) add({ severity: 'Low', title: 'Very thin page content', description: 'The page has a low visible word count.', evidence: `${data.wordCount} words.`, recommendation: 'Review whether the page gives users enough context and trust signals.' });
  return { data, issues };
}
