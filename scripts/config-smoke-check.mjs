import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { parseArgs, loadConfig, normaliseArgs } from '../src/lib/config.mjs';

const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'siteshot-config-'));
const configPath = path.join(tempDir, 'audit-config.json');

function assert(ok, message) {
  if (!ok) throw new Error(message);
}

try {
  await fs.writeFile(configPath, JSON.stringify({
    url: 'https://config.example',
    out: 'audit/config-file',
    devices: ['desktop'],
    pages: ['/'],
    maxPages: 3,
    depth: 1,
    waitMs: 250,
    modules: ['visual'],
    capture: {
      menu: true,
      interactions: true,
      acceptCookies: true,
      hideOverlays: true
    },
    exclude: ['/private'],
    flagText: ['placeholder'],
    budgets: { maxRequests: 10 },
    security: { checkCommonExposures: false }
  }, null, 2), 'utf8');

  const cliArgs = parseArgs(['audit', '--config', configPath, '--url', 'https://override.example']);
  const loaded = await loadConfig(cliArgs);

  assert(loaded.url === 'https://override.example', 'CLI URL should win when a config file is also supplied.');
  assert(loaded.out === 'audit/config-file', 'Config output path should load.');
  assert(loaded.pageList.includes('/'), 'Config pages should load.');
  assert(loaded.moduleList.includes('visual'), 'Config modules should load.');
  assert(loaded.captureMenu === true, 'Capture menu setting should load.');
  assert(loaded.captureInteractions === true, 'Capture interaction setting should load.');
  assert(loaded.acceptCookies === true, 'Cookie setting should load.');
  assert(loaded.hideOverlays === true, 'Overlay setting should load.');
  assert(loaded.excludeList.includes('/private'), 'Exclude list should load.');
  assert(loaded.flagTextList.includes('placeholder'), 'Flag text list should load.');

  const normalised = normaliseArgs({
    include: '',
    exclude: '',
    pages: '',
    flagText: '',
    modules: '',
    maxPages: 0,
    depth: Number.NaN,
    waitMs: -50
  });

  assert(normalised.maxPages === 40, 'Invalid maxPages should fall back to default.');
  assert(normalised.depth === 2, 'Invalid depth should fall back to default.');
  assert(normalised.waitMs === 0, 'Negative waitMs should clamp to zero.');

  console.log('Config smoke checks passed.');
} finally {
  await fs.rm(tempDir, { recursive: true, force: true });
}
