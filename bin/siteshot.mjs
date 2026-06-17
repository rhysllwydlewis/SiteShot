#!/usr/bin/env node
import fs from 'node:fs/promises';
import { parseArgs } from '../src/lib/config.mjs';
import { runAudit } from '../src/audit.mjs';
import { runDoctor } from '../src/doctor.mjs';
import { runCompare } from '../src/compare.mjs';
import { runZip } from '../src/zip-output.mjs';
import { runUiServer } from '../src/ui-server.mjs';

const args = parseArgs(process.argv.slice(2));

async function initConfig(outPath = 'siteshot.config.json') {
  const config = {
    name: 'Website ultra audit',
    url: 'https://example.com',
    out: 'audit/example-ultra',
    devices: ['iphone-se', 'iphone-14', 'galaxy-s21', 'desktop'],
    pages: ['/', '/pricing', '/contact'],
    modules: ['visual', 'functionality', 'seo', 'accessibility', 'performance', 'security', 'privacy', 'content', 'technical'],
    reportStyle: 'full',
    maxPages: 40,
    depth: 2,
    capture: { initial: true, fullPage: true, menu: true, interactions: true, acceptCookies: false, hideOverlays: false },
    waitMs: 1200,
    exclude: ['/admin', '/dashboard', '/api', '/assets'],
    flagText: ['Dashboard Log out', 'Version: loading', 'lorem ipsum', 'TODO'],
    budgets: { maxHorizontalOverflowPx: 8, minTapTargetPx: 40 }
  };
  await fs.writeFile(outPath, JSON.stringify(config, null, 2), 'utf8');
  console.log(`Created ${outPath}`);
}

try {
  if (args.command === 'audit') await runAudit(args);
  else if (args.command === 'doctor') await runDoctor();
  else if (args.command === 'ui') runUiServer();
  else if (args.command === 'init') await initConfig(args.out === 'audit/siteshot-ultra' ? 'siteshot.config.json' : args.out);
  else if (args.command === 'compare') await runCompare({ base: args.base, head: args.head });
  else if (args.command === 'zip') runZip({ dir: args.dir || args.out });
  else console.log('Commands: audit, doctor, init, compare, zip');
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
