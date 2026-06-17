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

  const inlineUrlArgs = parseArgs(['audit', '--url=https://inline.example/search?q=a=b&mode=test']);
  assert(inlineUrlArgs.url === 'https://inline.example/search?q=a=b&mode=test', 'Inline URL values should preserve equals signs after the first equals.');

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
  assert(normalised.waitMs === 1000, 'Invalid negative waitMs should fall back to default.');

  const zeroDepth = normaliseArgs({ include: '', exclude: '', pages: '', flagText: '', modules: '', maxPages: 1, depth: 0, waitMs: 0 });
  assert(zeroDepth.depth === 0, 'Depth zero should be allowed for homepage-only discovery.');
  assert(zeroDepth.waitMs === 0, 'Wait zero should be allowed for fast smoke checks.');

  console.log('Config smoke checks passed.');
} finally {
  await fs.rm(tempDir, { recursive: true, force: true });
}
