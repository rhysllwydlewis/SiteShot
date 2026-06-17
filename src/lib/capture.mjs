import path from 'node:path';
import { waitForPage } from './crawler.mjs';
import { safeNameFromUrl } from './utils.mjs';
import { tryOpenMenu, INTERACTION_TARGETS, pathMatches } from './interactions.mjs';
import { autoAcceptCookies, hideStickyOverlays } from './cookies.mjs';
import { dedupeIssues, makeIssue } from '../core/issues.mjs';
import { runVisualModule } from '../modules/visual.mjs';
import { runSeoModule } from '../modules/seo.mjs';
import { runAccessibilityModule } from '../modules/accessibility.mjs';
import { runFunctionalityModule } from '../modules/functionality.mjs';
import { runPerformanceModule } from '../modules/performance.mjs';
import { runSecurityModule } from '../modules/security.mjs';
import { runPrivacyModule } from '../modules/privacy.mjs';
import { runContentModule } from '../modules/content.mjs';
import { runTechnicalModule } from '../modules/technical.mjs';
import { runAuthModule } from '../modules/auth.mjs';
import { runFormsModule } from '../modules/forms.mjs';

async function looksLikeCapturedNotFound(page, status) {
  if (status >= 400) return true;
  try {
    const title = await page.title().catch(() => '');
    const h1 = await page.locator('h1').first().innerText({ timeout: 800 }).catch(() => '');
    const body = await page.locator('body').innerText({ timeout: 1000 }).catch(() => '');
    const compact = `${title} ${h1} ${body}`.replace(/\s+/g, ' ').trim();
    return /\b404\b|page not found|doesn'?t exist|does not exist/i.test(compact.slice(0, 1200));
  } catch {
    return false;
  }
}

async function tryCaptureInteractions(page, targetUrl, outDir, baseName, result) {
  for (const interaction of INTERACTION_TARGETS) {
    if (!pathMatches(targetUrl, interaction.paths)) continue;
    for (const selector of interaction.selectors) {
      try {
        const locator = page.locator(selector).first();
        if (!(await locator.count())) continue;
        const box = await locator.boundingBox({ timeout: 1000 }).catch(() => null);
        if (!box) continue;
        await locator.click({ timeout: 2500 });
        await page.waitForTimeout(700);
        const file = `screenshots/${baseName}__interaction-${interaction.name}.png`;
        await page.screenshot({ path: path.join(outDir, file), fullPage: false });
        result.files.push(file);
        result.interactions.push({ name: interaction.name, selector, file });
        break;
      } catch {}
    }
  }
}

export async function capturePageForDevice(browser, targetUrl, device, outDir, options) {
  const context = await browser.newContext({
    viewport: { width: device.width, height: device.height },
    isMobile: device.isMobile,
    deviceScaleFactor: device.deviceScaleFactor || 1,
    userAgent: device.userAgent,
    hasTouch: device.isMobile
  });

  const page = await context.newPage();
  const networkLog = [];
  const errors = [];

  page.on('response', async response => {
    const req = response.request();
    networkLog.push({ url: response.url(), status: response.status(), method: req.method(), resourceType: req.resourceType(), failed: false });
  });
  page.on('requestfailed', request => {
    networkLog.push({ url: request.url(), status: 0, method: request.method(), resourceType: request.resourceType(), failed: true, failure: request.failure()?.errorText || '' });
  });
  page.on('console', msg => {
    if (['error', 'warning'].includes(msg.type())) errors.push(`${msg.type()}: ${msg.text()}`.slice(0, 500));
  });
  page.on('pageerror', err => errors.push(`pageerror: ${err.message}`.slice(0, 500)));

  const baseName = `${safeNameFromUrl(targetUrl)}__${device.id}`;
  const result = {
    url: targetUrl,
    device: device.id,
    deviceName: device.name,
    width: device.width,
    height: device.height,
    files: [],
    errors,
    networkLog,
    menu: null,
    interactions: [],
    cookieConsent: null,
    hiddenOverlays: [],
    moduleData: {},
    issues: [],
    ok: false
  };

  try {
    const response = await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await waitForPage(page, options.waitMs);

    if (options.acceptCookies) {
      result.cookieConsent = await autoAcceptCookies(page);
      await waitForPage(page, 400);
    }
    if (options.hideOverlays) {
      result.hiddenOverlays = await hideStickyOverlays(page);
      await page.waitForTimeout(300);
    }

    result.status = response?.status() ?? null;
    result.finalUrl = page.url();

    const initialFile = `screenshots/${baseName}__initial.png`;
    await page.screenshot({ path: path.join(outDir, initialFile), fullPage: false });
    result.files.push(initialFile);

    const fullFile = `screenshots/${baseName}__full.png`;
    await page.screenshot({ path: path.join(outDir, fullFile), fullPage: true });
    result.files.push(fullFile);

    const notFoundLike = await looksLikeCapturedNotFound(page, result.status || 0);
    if (notFoundLike) {
      result.pageNotFound = true;
      result.ok = false;
      result.issues.push(makeIssue({
        module: 'functionality',
        category: 'Functionality',
        severity: 'High',
        title: 'Page route returned a 404 / not found page',
        description: 'The requested URL appears to return a 404 or route-level not found page.',
        url: targetUrl,
        evidence: `HTTP status: ${result.status || 'unknown'}; final URL: ${result.finalUrl || targetUrl}`,
        screenshot: initialFile,
        recommendation: 'Check the page URL, trailing slash behaviour, and deployed route configuration. Audit the canonical working URL rather than a 404 page.'
      }));
      result.issues = dedupeIssues(result.issues);
      return result;
    }

    if (options.captureMenu && device.isMobile) {
      const menu = await tryOpenMenu(page);
      result.menu = menu;
      if (menu.opened) {
        const menuFile = `screenshots/${baseName}__menu-open.png`;
        await page.screenshot({ path: path.join(outDir, menuFile), fullPage: false });
        result.files.push(menuFile);
      }
    }

    if (options.captureInteractions) await tryCaptureInteractions(page, targetUrl, outDir, baseName, result);

    const moduleList = options.moduleList || [];
    const ctx = { ...options, baseUrl: options.baseUrl || targetUrl };

    if (moduleList.includes('visual')) {
      const mod = await runVisualModule(page, targetUrl, { flagText: options.flagText, budgets: options.budgets }, initialFile);
      result.moduleData.visual = mod.data; result.issues.push(...mod.issues);
    }
    if (moduleList.includes('seo')) {
      const mod = await runSeoModule(page, targetUrl);
      result.moduleData.seo = mod.data; result.issues.push(...mod.issues);
    }
    if (moduleList.includes('accessibility')) {
      const mod = await runAccessibilityModule(page, targetUrl);
      result.moduleData.accessibility = mod.data; result.issues.push(...mod.issues);
    }
    if (moduleList.includes('functionality')) {
      const mod = await runFunctionalityModule(page, targetUrl, networkLog, ctx);
      result.moduleData.functionality = mod.data; result.issues.push(...mod.issues);
    }
    if (moduleList.includes('performance')) {
      const mod = await runPerformanceModule(page, targetUrl, networkLog, options.budgets || {});
      result.moduleData.performance = mod.data; result.issues.push(...mod.issues);
    }
    if (moduleList.includes('security')) {
      const mod = await runSecurityModule(page, ctx, targetUrl, response, context);
      result.moduleData.security = mod.data; result.issues.push(...mod.issues);
    }
    if (moduleList.includes('privacy')) {
      const mod = await runPrivacyModule(page, targetUrl);
      result.moduleData.privacy = mod.data; result.issues.push(...mod.issues);
    }
    if (moduleList.includes('content')) {
      const mod = await runContentModule(page, targetUrl);
      result.moduleData.content = mod.data; result.issues.push(...mod.issues);
    }
    if (moduleList.includes('auth')) {
      const mod = await runAuthModule(page, targetUrl);
      result.moduleData.auth = mod.data; result.issues.push(...mod.issues);
    }
    if (moduleList.includes('forms')) {
      const mod = await runFormsModule(page, targetUrl);
      result.moduleData.forms = mod.data; result.issues.push(...mod.issues);
    }
    if (moduleList.includes('technical')) {
      const mod = await runTechnicalModule(page, targetUrl, errors, networkLog, options.budgets || {});
      result.moduleData.technical = mod.data; result.issues.push(...mod.issues);
    }

    result.issues = dedupeIssues(result.issues);
    result.ok = true;
  } catch (error) {
    result.errors.push(error.message);
  } finally {
    await context.close();
  }
  return result;
}
