#!/usr/bin/env node
import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import { parseDevice } from './lib/devices.mjs';
import { loadConfig } from './lib/config.mjs';
import { discoverPages } from './lib/crawler.mjs';
import { capturePageForDevice } from './lib/capture.mjs';
import { splitList } from './lib/utils.mjs';
import { writeAllReports } from './reporting/reports.mjs';
import { runSiteSeoChecks } from './modules/seo.mjs';

export async function runAudit(rawOptions) {
  const options = await loadConfig(rawOptions);
  if (!options.url) throw new Error('Missing --url.');

  const deviceList = splitList(options.devices).map(parseDevice).filter(Boolean);
  if (!deviceList.length) throw new Error('No valid devices selected. Choose at least one preset or a valid custom viewport.');
  await fs.mkdir(path.join(options.out, 'screenshots'), { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const pages = await discoverPages(browser, options);

  const manifest = {
    tool: 'siteshot-auditor-studio-ultra',
    version: '3.2.23',
    targetUrl: new URL(options.url).href,
    createdAt: new Date().toISOString(),
    options: {
      maxPages: options.maxPages,
      depth: options.depth,
      waitMs: options.waitMs,
      modules: options.moduleList,
      reportStyle: options.reportStyle,
      scopeMode: options.scopeMode,
      captureMenu: options.captureMenu,
      captureInteractions: options.captureInteractions,
      acceptCookies: options.acceptCookies,
      hideOverlays: options.hideOverlays,
      include: options.includeList,
      exclude: options.excludeList,
      flagText: options.flagTextList,
      budgets: options.budgets || {},
      security: options.security || {}
    },
    devices: deviceList,
    pages,
    siteWideIssues: [],
    results: []
  };

  if (options.moduleList.includes('seo')) {
    const reqPage = await browser.newPage();
    manifest.siteWideIssues.push(...await runSiteSeoChecks(reqPage.request, options.url));
    await reqPage.close();
  }

  for (const url of pages) {
    const pageResult = { url, captures: [] };
    let routeFailed = false;

    for (const device of deviceList) {
      if (routeFailed) {
        console.log(`Skipping ${url} on ${device.id} because the route already returned a 404/not found page.`);
        continue;
      }

      console.log(`Auditing ${url} on ${device.id}`);
      const capture = await capturePageForDevice(browser, url, device, options.out, {
        waitMs: options.waitMs,
        captureMenu: options.captureMenu,
        captureInteractions: options.captureInteractions,
        acceptCookies: options.acceptCookies,
        hideOverlays: options.hideOverlays,
        flagText: options.flagTextList,
        budgets: options.budgets || {},
        security: options.security || {},
        moduleList: options.moduleList,
        baseUrl: options.url
      });
      pageResult.captures.push(capture);

      if (capture.pageNotFound) {
        routeFailed = true;
        console.log(`Route appears invalid/not found for ${url}. Further device captures skipped to avoid repeated 404 screenshots.`);
      }
    }
    manifest.results.push(pageResult);
  }

  await browser.close();
  await fs.writeFile(path.join(options.out, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');
  await writeAllReports(options.out, manifest);
  const issueCount = manifest.siteWideIssues.length + manifest.results.flatMap(r => r.captures).reduce((sum, c) => sum + (c.issues || []).length, 0);
  console.log(`Done. Found ${issueCount} issue(s).`);
  console.log(`Open ${path.join(options.out, 'report.html')}`);
  return manifest;
}
