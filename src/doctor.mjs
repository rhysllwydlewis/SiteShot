#!/usr/bin/env node
import { chromium } from 'playwright';

export async function runDoctor() {
  console.log('SiteShot Auditor Studio Ultra Doctor');
  console.log('Node:', process.version);
  try {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.setContent('<h1>Playwright OK</h1>');
    const text = await page.locator('h1').innerText();
    await browser.close();
    console.log('Chromium:', text === 'Playwright OK' ? 'OK' : 'unexpected result');
    console.log('Ready to run audits.');
  } catch (error) {
    console.error('Chromium launch failed.');
    console.error(error.message);
    console.error('Try: npm.cmd run install:browsers');
    process.exitCode = 1;
  }
}
