const COOKIE_SELECTORS = [
  '#onetrust-accept-btn-handler',
  '#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll',
  '#CybotCookiebotDialogBodyButtonAccept',
  '[data-testid*="accept" i]',
  'button[id*="accept" i]',
  'button[class*="accept" i]',
  'button[aria-label*="accept" i]',
  'button:has-text("Accept all")',
  'button:has-text("Accept All")',
  'button:has-text("Accept cookies")',
  'button:has-text("I accept")',
  'button:has-text("I agree")',
  'button:has-text("Allow all")',
  'button:has-text("Got it")',
  'button:has-text("OK")',
  'button:has-text("Continue")',
  '[role="button"]:has-text("Accept all")',
  '[role="button"]:has-text("I agree")'
];

export async function autoAcceptCookies(page) {
  await page.waitForTimeout(350);
  for (const selector of COOKIE_SELECTORS) {
    try {
      const locator = page.locator(selector).first();
      if (!(await locator.count())) continue;
      const box = await locator.boundingBox({ timeout: 750 }).catch(() => null);
      if (!box) continue;
      const text = await locator.innerText({ timeout: 750 }).catch(() => '');
      await locator.click({ timeout: 2500 });
      await page.waitForTimeout(650);
      return { accepted: true, selector, text: text.trim().slice(0, 120) };
    } catch {}
  }
  return { accepted: false };
}

export async function hideStickyOverlays(page) {
  return await page.evaluate(() => {
    const keywords = ['cookie', 'consent', 'banner', 'gdpr', 'privacy', 'popup', 'modal', 'chat', 'subscribe'];
    const hidden = [];
    for (const el of [...document.querySelectorAll('body *')]) {
      const style = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      const text = (el.innerText || '').toLowerCase().slice(0, 500);
      const idClass = `${el.id || ''} ${el.className || ''}`.toLowerCase();
      const isOverlay = ['fixed', 'sticky'].includes(style.position);
      const large = rect.width > window.innerWidth * 0.25 && rect.height > 35;
      const likely = keywords.some(word => text.includes(word) || idClass.includes(word));
      if (isOverlay && large && likely) {
        el.style.setProperty('display', 'none', 'important');
        hidden.push({ tag: el.tagName.toLowerCase(), id: el.id || '', className: String(el.className || '').slice(0, 100) });
      }
    }
    return hidden.slice(0, 40);
  });
}
