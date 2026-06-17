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

const MAX_NETWORK_LOG_ENTRIES = 750;

function pushNetworkEntry(networkLog, entry) {
  if (networkLog.length < MAX_NETWORK_LOG_ENTRIES) networkLog.push(entry);
}

async function runModuleSafely(result, moduleName, category, targetUrl, runner) {
  try {
    const mod = await runner();
    result.moduleData[moduleName] = mod.data;
    result.issues.push(...(mod.issues || []));
  } catch (error) {
    const message = error?.message || String(error);
    result.moduleData[moduleName] = { error: message };
    result.errors.push(`${moduleName}: ${message}`.slice(0, 500));
    result.issues.push(makeIssue({
      module: moduleName,
      category,
      severity: 'Medium',
      title: `${category} module failed to complete`,
      description: `The ${category} audit module failed before it could complete. Other modules continued running for this page/device.`,
      url: targetUrl,
      evidence: message,
      recommendation: 'Review the captured page behaviour and rerun the audit. If the issue repeats, inspect the module error and page console output.'
    }));
  }
}

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
    pushNetworkEntry(networkLog, { url: response.url(), status: response.status(), method: req.method(), resourceType: req.resourceType(), failed: false });
  });
  page.on('requestfailed', request => {
    pushNetworkEntry(networkLog, { url: request.url(), status: 0, method: request.method(), resourceType: request.resourceType(), failed: true, failure: request.failure()?.errorText || '' });
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

    // Module results are stored by key, for example moduleData.auth and moduleData.forms.
    if (moduleList.includes('visual')) await runModuleSafely(result, 'visual', 'Visual', targetUrl, () => runVisualModule(page, targetUrl, { flagText: options.flagText, budgets: options.budgets }, initialFile));
    if (moduleList.includes('seo')) await runModuleSafely(result, 'seo', 'SEO', targetUrl, () => runSeoModule(page, targetUrl));
    if (moduleList.includes('accessibility')) await runModuleSafely(result, 'accessibility', 'Accessibility', targetUrl, () => runAccessibilityModule(page, targetUrl));
    if (moduleList.includes('functionality')) await runModuleSafely(result, 'functionality', 'Functionality', targetUrl, () => runFunctionalityModule(page, targetUrl, networkLog, ctx));
    if (moduleList.includes('performance')) await runModuleSafely(result, 'performance', 'Performance', targetUrl, () => runPerformanceModule(page, targetUrl, networkLog, options.budgets || {}));
    if (moduleList.includes('security')) await runModuleSafely(result, 'security', 'Security', targetUrl, () => runSecurityModule(page, ctx, targetUrl, response, context));
    if (moduleList.includes('privacy')) await runModuleSafely(result, 'privacy', 'Privacy', targetUrl, () => runPrivacyModule(page, targetUrl));
    if (moduleList.includes('content')) await runModuleSafely(result, 'content', 'Content', targetUrl, () => runContentModule(page, targetUrl));
    if (moduleList.includes('auth')) await runModuleSafely(result, 'auth', 'Auth', targetUrl, () => runAuthModule(page, targetUrl));
    if (moduleList.includes('forms')) await runModuleSafely(result, 'forms', 'Forms', targetUrl, () => runFormsModule(page, targetUrl));
    if (moduleList.includes('technical')) await runModuleSafely(result, 'technical', 'Technical', targetUrl, () => runTechnicalModule(page, targetUrl, errors, networkLog, options.budgets || {}));

    result.issues = dedupeIssues(result.issues);
    result.ok = true;
  } catch (error) {
    result.errors.push(error.message);
  } finally {
    await context.close().catch(() => {});
  }
  return result;
}
