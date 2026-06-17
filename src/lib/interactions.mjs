export const MENU_SELECTORS = [
  'button[aria-label*="menu" i]',
  'button[aria-label*="navigation" i]',
  'button[data-menu-toggle]',
  '[data-menu-toggle]',
  '.menu-toggle',
  '.hamburger',
  '.navbar-toggler',
  '.mobile-menu-toggle',
  '#menu-toggle',
  '#mobile-menu-button',
  'button:has-text("Menu")',
  'button:has-text("☰")'
];

export const INTERACTION_TARGETS = [
  { name: 'filters', paths: ['/suppliers', '/marketplace', '/public-calendar', '/guides'], selectors: ['button:has-text("Filter")', 'button:has-text("Filters")', '[data-testid*="filter" i]', '.filter-toggle', '.filters-toggle'] },
  { name: 'auth-create-account', paths: ['/auth'], selectors: ['button:has-text("Create account")', 'a:has-text("Create account")', 'button:has-text("Sign up")', 'a:has-text("Sign up")'] },
  { name: 'pricing', paths: ['/pricing'], selectors: ['button:has-text("Compare")', 'button:has-text("Features")', '[data-testid*="pricing" i]', 'summary'] },
  { name: 'wizard-first-choice', paths: ['/start'], selectors: ['button:has-text("Wedding")', 'button:has-text("Birthday")', '[data-template-id]', '.wizard-template-card'] },
  { name: 'accordion', paths: ['/faq', '/legal', '/privacy', '/terms'], selectors: ['summary', 'button[aria-expanded="false"]', '.accordion button'] }
];

export function pathMatches(targetUrl, paths) {
  const pathname = new URL(targetUrl).pathname;
  return paths.some(item => pathname === item || pathname.startsWith(`${item}/`));
}

export async function tryOpenMenu(page) {
  for (const selector of MENU_SELECTORS) {
    try {
      const locator = page.locator(selector).first();
      if (!(await locator.count())) continue;
      const box = await locator.boundingBox({ timeout: 1000 }).catch(() => null);
      if (!box) continue;
      await locator.click({ timeout: 2500 });
      await page.waitForTimeout(500);
      return { opened: true, selector };
    } catch {}
  }
  return { opened: false, selector: null };
}
