import fs from 'node:fs/promises';
import { splitList } from './utils.mjs';

export const DEFAULT_EXCLUDES = ['/api', '/assets', '/uploads', '/static', '/node_modules', '/admin', '/dashboard', '/logout'];
export const DEFAULT_FLAG_TEXT = ['Dashboard Log out', 'Mark all as read', 'Version: loading', 'lorem ipsum', 'TODO'];
export const DEFAULT_MODULES = ['visual', 'functionality', 'seo', 'accessibility', 'performance', 'security', 'privacy', 'content', 'technical', 'auth', 'forms'];

export function parseArgs(argv) {
  const command = argv[0] && !argv[0].startsWith('--') ? argv[0] : 'audit';
  const raw = command === 'audit' ? argv.slice(argv[0] && !argv[0].startsWith('--') ? 1 : 0) : argv.slice(1);

  const args = {
    command,
    url: '',
    out: 'audit/siteshot-ultra',
    devices: 'desktop-wide,laptop,ipad,iphone-pro-max,iphone-se',
    maxPages: 40,
    depth: 2,
    waitMs: 1000,
    config: '',
    pages: '',
    include: '',
    exclude: DEFAULT_EXCLUDES.join(','),
    flagText: DEFAULT_FLAG_TEXT.join('|'),
    modules: DEFAULT_MODULES.join(','),
    reportStyle: 'full',
    scopeMode: 'exact',
    respectRobots: true,
    menu: false,
    interactions: false,
    acceptCookies: false,
    hideOverlays: false,
    exportZip: false,
    base: '',
    head: '',
    dir: ''
  };

  for (let i = 0; i < raw.length; i += 1) {
    const arg = raw[i];
    if (arg === '--menu') { args.menu = true; continue; }
    if (arg === '--interactions') { args.interactions = true; continue; }
    if (arg === '--accept-cookies') { args.acceptCookies = true; continue; }
    if (arg === '--hide-overlays') { args.hideOverlays = true; continue; }
    if (arg === '--export-zip') { args.exportZip = true; continue; }
    if (arg === '--respect-robots') { args.respectRobots = true; continue; }
    if (arg === '--no-respect-robots') { args.respectRobots = false; continue; }
    if (arg === '--no-security') { args.modules = args.modules.split(',').filter(m => m !== 'security').join(','); continue; }
    if (arg === '--safe-security') { if (!args.modules.includes('security')) args.modules += ',security'; continue; }

    const [key, inlineValue] = arg.startsWith('--') ? arg.split('=') : [null, null];
    if (!key) continue;
    const name = key.replace(/^--/, '');
    const value = inlineValue ?? raw[i + 1];
    if (inlineValue === undefined) i += 1;

    if (name === 'url') args.url = value;
    else if (name === 'out') args.out = value;
    else if (name === 'devices') args.devices = value;
    else if (name === 'max-pages') args.maxPages = Number(value);
    else if (name === 'depth') args.depth = Number(value);
    else if (name === 'wait') args.waitMs = Number(value);
    else if (name === 'config') args.config = value;
    else if (name === 'pages') args.pages = value;
    else if (name === 'include') args.include = value;
    else if (name === 'exclude') args.exclude = value;
    else if (name === 'flag-text') args.flagText = value;
    else if (name === 'modules') args.modules = value;
    else if (name === 'report-style') args.reportStyle = value;
    else if (name === 'scope-mode') args.scopeMode = value;
    else if (name === 'base') args.base = value;
    else if (name === 'head') args.head = value;
    else if (name === 'dir') args.dir = value;
  }

  return args;
}

export async function loadConfig(args) {
  if (!args.config) return normaliseArgs(args);
  const file = JSON.parse(await fs.readFile(args.config, 'utf8'));
  const capture = file.capture || {};

  return normaliseArgs({
    ...args,
    url: file.url ?? args.url,
    out: file.out ?? args.out,
    devices: Array.isArray(file.devices) ? file.devices.join(',') : args.devices,
    maxPages: file.maxPages ?? args.maxPages,
    depth: file.depth ?? args.depth,
    waitMs: file.waitMs ?? args.waitMs,
    pages: Array.isArray(file.pages) ? file.pages.join(',') : args.pages,
    include: Array.isArray(file.include) ? file.include.join(',') : args.include,
    exclude: Array.isArray(file.exclude) ? file.exclude.join(',') : args.exclude,
    flagText: Array.isArray(file.flagText) ? file.flagText.join('|') : args.flagText,
    modules: Array.isArray(file.modules) ? file.modules.join(',') : args.modules,
    reportStyle: file.reportStyle ?? args.reportStyle,
    scopeMode: file.scopeMode ?? args.scopeMode,
    respectRobots: file.respectRobots ?? args.respectRobots,
    menu: capture.menu ?? args.menu,
    interactions: capture.interactions ?? args.interactions,
    acceptCookies: capture.acceptCookies ?? args.acceptCookies,
    hideOverlays: capture.hideOverlays ?? args.hideOverlays,
    budgets: file.budgets || {},
    security: file.security || {}
  });
}

export function normaliseArgs(args) {
  return {
    ...args,
    includeList: splitList(args.include),
    excludeList: splitList(args.exclude),
    pageList: splitList(args.pages),
    flagTextList: splitList(args.flagText, '|'),
    moduleList: splitList(args.modules),
    captureMenu: Boolean(args.menu),
    captureInteractions: Boolean(args.interactions),
    acceptCookies: Boolean(args.acceptCookies),
    hideOverlays: Boolean(args.hideOverlays),
    scopeMode: args.scopeMode || 'exact',
    respectRobots: args.respectRobots !== false,
    budgets: args.budgets || {},
    security: args.security || {}
  };
}
