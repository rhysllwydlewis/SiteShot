import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appRootDir = path.resolve(__dirname, '..', '..');
const appNodeModulesBrowserPath = path.join(appRootDir, 'node_modules', 'playwright-core', '.local-browsers');
const appLocalBrowserPath = path.join(appRootDir, 'playwright-browsers');
const resourcesBrowserPath = process.resourcesPath ? path.join(process.resourcesPath, 'playwright-browsers') : '';

function hasChromiumBrowser(browserPath) {
  if (!browserPath) return false;

  try {
    if (!fs.existsSync(browserPath)) return false;
    return fs.readdirSync(browserPath).some(name => /chromium/i.test(name));
  } catch {
    return false;
  }
}

function isPackagedRuntime() {
  return Boolean(process.defaultApp === false || process.resourcesPath?.includes('resources'));
}

function findBundledBrowserPath() {
  const candidates = [
    resourcesBrowserPath,
    appLocalBrowserPath,
    appNodeModulesBrowserPath
  ];

  return candidates.find(hasChromiumBrowser) || '';
}

export function configureBundledPlaywrightBrowsers() {
  if (process.env.PLAYWRIGHT_BROWSERS_PATH && hasChromiumBrowser(process.env.PLAYWRIGHT_BROWSERS_PATH)) {
    return process.env.PLAYWRIGHT_BROWSERS_PATH;
  }

  const bundledPath = findBundledBrowserPath();

  if (bundledPath) {
    process.env.PLAYWRIGHT_BROWSERS_PATH = bundledPath;
    return bundledPath;
  }

  if (isPackagedRuntime() && resourcesBrowserPath) {
    process.env.PLAYWRIGHT_BROWSERS_PATH = resourcesBrowserPath;
    return resourcesBrowserPath;
  }

  return process.env.PLAYWRIGHT_BROWSERS_PATH || '';
}

export async function getChromium() {
  configureBundledPlaywrightBrowsers();
  const playwright = await import('playwright');
  return playwright.chromium;
}
