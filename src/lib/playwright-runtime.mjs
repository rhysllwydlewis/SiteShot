import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..', '..');
const bundledBrowserPath = path.join(rootDir, 'node_modules', 'playwright-core', '.local-browsers');

function hasBundledBrowsers() {
  try {
    return fs.existsSync(bundledBrowserPath) && fs.readdirSync(bundledBrowserPath).some(name => /chromium/i.test(name));
  } catch {
    return false;
  }
}

function isPackagedRuntime() {
  return process.defaultApp === false;
}

export function configureBundledPlaywrightBrowsers() {
  if (process.env.PLAYWRIGHT_BROWSERS_PATH) return process.env.PLAYWRIGHT_BROWSERS_PATH;

  if (hasBundledBrowsers() || isPackagedRuntime()) {
    process.env.PLAYWRIGHT_BROWSERS_PATH = bundledBrowserPath;
  }

  return process.env.PLAYWRIGHT_BROWSERS_PATH || '';
}

export async function getChromium() {
  configureBundledPlaywrightBrowsers();
  const playwright = await import('playwright');
  return playwright.chromium;
}
