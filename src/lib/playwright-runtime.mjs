import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..', '..');
const bundledBrowserPath = path.join(rootDir, 'node_modules', 'playwright-core', '.local-browsers');

export function configureBundledPlaywrightBrowsers() {
  if (!process.env.PLAYWRIGHT_BROWSERS_PATH) {
    process.env.PLAYWRIGHT_BROWSERS_PATH = bundledBrowserPath;
  }
  return process.env.PLAYWRIGHT_BROWSERS_PATH;
}

export async function getChromium() {
  configureBundledPlaywrightBrowsers();
  const playwright = await import('playwright');
  return playwright.chromium;
}
