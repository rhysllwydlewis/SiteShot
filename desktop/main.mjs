import { app, BrowserWindow, ipcMain, shell, dialog, Menu } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import fsp from 'node:fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

let mainWindow;
let activeProcess = null;

const REPORT_FILES = {
  report: 'report.html',
  quick: 'quick-report.html',
  full: 'full-report.html',
  client: 'client-report.html',
  executive: 'executive-summary.html',
  technical: 'technical-report.html',
  roadmap: 'fix-roadmap.html',
  gallery: 'gallery.html',
  pdf: 'report.pdf',
  docx: 'report.docx',
  issuesCsv: 'issues.csv',
  issuesJson: 'issues.json',
  tickets: 'tickets.md',
  summaryPath: 'summary.json',
  manifest: 'manifest.json'
};

function storePath() {
  return path.join(app.getPath('userData'), 'siteshot-store.json');
}

const defaultStore = {
  runs: [],
  projects: [],
  templates: [],
  settings: {
    defaultOutputRoot: '',
    lastTarget: 'https://event-flow.co.uk',
    lastOutput: 'audit/eventflow-ultra'
  }
};

async function readStore() {
  try {
    const p = storePath();
    if (!fs.existsSync(p)) return structuredClone(defaultStore);
    return { ...structuredClone(defaultStore), ...JSON.parse(await fsp.readFile(p, 'utf8')) };
  } catch {
    return structuredClone(defaultStore);
  }
}

async function writeStore(store) {
  await fsp.mkdir(path.dirname(storePath()), { recursive: true });
  await fsp.writeFile(storePath(), JSON.stringify(store, null, 2), 'utf8');
  return store;
}

function createWindow() {
  Menu.setApplicationMenu(null);
  mainWindow = new BrowserWindow({
    width: 1600,
    height: 1030,
    minWidth: 1280,
    minHeight: 820,
    title: 'SiteShot Auditor Studio Ultra',
    backgroundColor: '#07111c',
    frame: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  mainWindow.loadFile(path.join(__dirname, 'index.html'));
}

function sendLog(text) {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('audit-log', text);
}


function reportStyleLabel(style) {
  const labels = {
    full: 'Full Professional Report',
    executive: 'Executive Summary',
    technical: 'Technical Report',
    quick: 'Basic / Quick Report',
    client: 'Client Report'
  };
  const key = String(style || '').toLowerCase();
  return labels[key] || 'Legacy run - report type unknown';
}

function safeSlug(value) {
  return String(value || 'site').replace(/^https?:\/\//i, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'site';
}

function resolveOutputPath(out, targetUrl = '', defaultOutputRoot = '') {
  if (out && path.isAbsolute(out)) return out;
  const cleaned = String(out || '').replace(/^audit[\\/]/i, '').replace(/[<>:"|?*]/g, '-');
  const configuredRoot = defaultOutputRoot && path.isAbsolute(defaultOutputRoot) ? defaultOutputRoot : '';
  const root = configuredRoot || path.join(app.getPath('documents'), 'SiteShot Audits');
  return path.join(root, cleaned || safeSlug(targetUrl));
}

async function readJsonSafe(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(await fsp.readFile(filePath, 'utf8'));
  } catch {
    return null;
  }
}

async function fileExists(filePath) {
  try {
    await fsp.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function listOutputFiles(outDir) {
  try {
    const names = await fsp.readdir(outDir);
    return names.sort();
  } catch {
    return [];
  }
}

function htmlEscape(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[ch]));
}

async function ensureFallbackReports(outDir, summary, targetUrl) {
  await fsp.mkdir(outDir, { recursive: true });

  const reportPath = path.join(outDir, REPORT_FILES.report);
  const quickPath = path.join(outDir, REPORT_FILES.quick);
  const fullPath = path.join(outDir, REPORT_FILES.full);
  const galleryPath = path.join(outDir, REPORT_FILES.gallery);
  const execPath = path.join(outDir, REPORT_FILES.executive);
  const techPath = path.join(outDir, REPORT_FILES.technical);
  const roadmapPath = path.join(outDir, REPORT_FILES.roadmap);

  const files = await listOutputFiles(outDir);
  const statsHtml = summary ? `
    <div class="stat"><span>Score</span><strong>${htmlEscape(summary.scores?.overall ?? '-')}</strong></div>
    <div class="stat"><span>Grade</span><strong>${htmlEscape(summary.scores?.grade ?? '-')}</strong></div>
    <div class="stat"><span>Issues</span><strong>${htmlEscape(summary.issueCount ?? '-')}</strong></div>
    <div class="stat"><span>Pages</span><strong>${htmlEscape(summary.pageCount ?? '-')}</strong></div>
  ` : '<p>No summary.json was available when this fallback was created.</p>';

  const baseHtml = title => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>${title}</title><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
body{margin:0;background:#f3f7f7;color:#10252c;font-family:Inter,Segoe UI,Arial,sans-serif}
header{background:linear-gradient(135deg,#0f766e,#10252c);color:white;padding:42px}
main{max-width:1100px;margin:auto;padding:28px}
.panel{background:white;border:1px solid #dbe7e8;border-radius:18px;padding:22px;margin-bottom:18px;box-shadow:0 14px 36px rgba(16,37,44,.08)}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px}.stat{background:#eef8f6;border-radius:16px;padding:16px}.stat span{display:block;color:#60747b;font-size:13px}.stat strong{font-size:30px}
code,pre{background:#10252c;color:#dffaf5;border-radius:10px;padding:10px;display:block;overflow:auto}
a{color:#0f766e;font-weight:700}
</style></head><body>
<header><h1>${title}</h1><p>${htmlEscape(targetUrl || summary?.targetUrl || 'Website audit')}</p></header>
<main>
<section class="panel"><h2>Report recovery notice</h2><p>The audit completed, but one or more expected report files were not found at open time. This fallback report was created automatically so you still have a readable output and can open the output folder.</p></section>
<section class="panel"><h2>Audit summary</h2><div class="stats">${statsHtml}</div></section>
<section class="panel"><h2>Available files in output folder</h2><pre>${htmlEscape(files.join('\n') || 'No files were listed.')}</pre></section>
<section class="panel"><h2>Useful files</h2><p><a href="./manifest.json">manifest.json</a> · <a href="./summary.json">summary.json</a> · <a href="./issues.json">issues.json</a> · <a href="./issues.csv">issues.csv</a> · <a href="./tickets.md">tickets.md</a></p></section>
</main></body></html>`;

  const created = [];
  if (!(await fileExists(reportPath))) {
    await fsp.writeFile(reportPath, baseHtml('Recovered Selected Website Audit Report'), 'utf8');
    created.push(REPORT_FILES.report);
  }
  if (!(await fileExists(quickPath))) {
    await fsp.writeFile(quickPath, baseHtml('Recovered Basic / Quick Report'), 'utf8');
    created.push(REPORT_FILES.quick);
  }
  if (!(await fileExists(fullPath))) {
    await fsp.writeFile(fullPath, baseHtml('Recovered Full Professional Report'), 'utf8');
    created.push(REPORT_FILES.full);
  }
  if (!(await fileExists(execPath))) {
    await fsp.writeFile(execPath, baseHtml('Recovered Executive Summary'), 'utf8');
    created.push(REPORT_FILES.executive);
  }
  if (!(await fileExists(techPath))) {
    await fsp.writeFile(techPath, baseHtml('Recovered Technical Report'), 'utf8');
    created.push(REPORT_FILES.technical);
  }
  if (!(await fileExists(roadmapPath))) {
    await fsp.writeFile(roadmapPath, baseHtml('Recovered Fix Roadmap'), 'utf8');
    created.push(REPORT_FILES.roadmap);
  }
  if (!(await fileExists(galleryPath))) {
    await fsp.writeFile(galleryPath, baseHtml('Recovered Screenshot Gallery'), 'utf8');
    created.push(REPORT_FILES.gallery);
  }

  return created;
}

async function buildReportPayload(outDir, code, targetUrl = '') {
  const summary = await readJsonSafe(path.join(outDir, REPORT_FILES.summaryPath));
  const createdFallbacks = code === 0 ? await ensureFallbackReports(outDir, summary, targetUrl) : [];

  const payload = {
    code,
    outDir,
    createdFallbacks,
    availableReports: {},
    summary
  };

  for (const [key, file] of Object.entries(REPORT_FILES)) {
    const filePath = path.join(outDir, file);
    payload[key] = filePath;
    payload.availableReports[key] = await fileExists(filePath);
  }

  return payload;
}

async function addRunToStore(run) {
  const store = await readStore();
  store.runs = [run, ...(store.runs || [])].slice(0, 100);
  store.settings.lastTarget = run.targetUrl || store.settings.lastTarget;
  store.settings.lastOutput = run.outDir || store.settings.lastOutput;
  await writeStore(store);
  mainWindow?.webContents.send('store-updated', store);
}

async function findSameNamedFile(parentDir, basename, depth = 2) {
  if (!parentDir || depth < 0 || !fs.existsSync(parentDir)) return null;
  try {
    const entries = await fsp.readdir(parentDir, { withFileTypes: true });
    for (const entry of entries) {
      const candidate = path.join(parentDir, entry.name);
      if (entry.isFile() && entry.name.toLowerCase() === basename.toLowerCase()) return candidate;
    }
    if (depth > 0) {
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const found = await findSameNamedFile(path.join(parentDir, entry.name), basename, depth - 1);
        if (found) return found;
      }
    }
  } catch {}
  return null;
}

function repairPossiblyEscapedWindowsPath(inputPath) {
  let value = String(inputPath || '');

  // If a Windows path was accidentally injected into an HTML/JS string, backslashes
  // can be interpreted as escape sequences. This attempts to recover the common case.
  value = value.replace(/\r/g, '\\r').replace(/\n/g, '\\n').replace(/\t/g, '\\t');

  // C:UsersrszDocumentsSiteShot Auditseventflow-ultrareport.html -> try to recover.
  const driveMatch = value.match(/([A-Za-z]):/);
  if (driveMatch && !/^[A-Za-z]:[\\/]/.test(value)) {
    value = value.replace(/^.*?([A-Za-z]):/, '$1:\\');
  }

  // Strip accidental app-folder prefix before a drive letter if present.
  const embeddedDrive = value.match(/([A-Za-z]:[\\/].*)/);
  if (embeddedDrive) value = embeddedDrive[1];

  return value;
}

async function deletePathSafe(targetPath) {
  if (!targetPath) return false;
  const resolved = path.resolve(targetPath);
  if (!fs.existsSync(resolved)) return false;
  await fsp.rm(resolved, { recursive: true, force: true });
  return true;
}



function buildFallbackDiscoveryResult(targetUrl, reason = 'Discovery could not build a larger validated page list', mode = 'fallback') {
  const parsed = new URL(targetUrl);
  const origin = parsed.origin;
  const host = parsed.hostname.toLowerCase().replace(/^www\./, '');

  const genericRoutes = [
    '/',
    '/about',
    '/contact',
    '/services',
    '/pricing',
    '/faq',
    '/help',
    '/support',
    '/blog',
    '/news',
    '/events',
    '/login',
    '/signup',
    '/privacy',
    '/terms'
  ];

  const hostSpecificRoutes = [];
  if (host.includes('facebook.com')) {
    hostSpecificRoutes.push('/login', '/pages', '/groups', '/marketplace', '/events', '/watch', '/gaming', '/help', '/privacy', '/terms');
  } else if (host.includes('linkedin.com')) {
    hostSpecificRoutes.push('/login', '/signup', '/jobs', '/company', '/learning', '/help', '/legal/privacy-policy', '/legal/user-agreement');
  } else if (host.includes('instagram.com')) {
    hostSpecificRoutes.push('/accounts/login/', '/explore/', '/reels/', '/about/us/', '/privacy/', '/terms/');
  } else if (host.includes('x.com') || host.includes('twitter.com')) {
    hostSpecificRoutes.push('/login', '/i/flow/signup', '/explore', '/settings', '/privacy', '/tos');
  }

  const seeds = [
    targetUrl,
    origin,
    ...hostSpecificRoutes.map(route => `${origin}${route}`),
    ...genericRoutes.map(route => `${origin}${route}`)
  ];

  const seen = new Set();
  const included = [];
  for (const raw of seeds) {
    try {
      const url = new URL(raw, origin).href;
      if (seen.has(url)) continue;
      seen.add(url);
      included.push({
        url,
        source: url === targetUrl || url === `${origin}/` ? 'fallback-home' : hostSpecificRoutes.some(route => url === `${origin}${route}`) ? 'fallback-platform-route' : 'fallback-common-route',
        included: true,
        status: 'fallback',
        reason
      });
    } catch {}
  }

  return {
    mode,
    included,
    rejected: [{
      url: `${origin}/sitemap.xml`,
      source: 'fallback',
      included: false,
      status: 'limited',
      reason
    }],
    summary: {
      candidates: included.length,
      included: included.length,
      rejected: 1,
      sources: [...new Set(included.map(item => item.source))]
    },
    fallback: true,
    limited: true,
    message: `${reason}. I have returned a safe starter page list instead of leaving discovery at one page.`
  };
}

function isLowYieldDiscovery(result) {
  const included = Array.isArray(result?.included) ? result.included : [];
  if (included.length === 0) return true;
  if (included.length === 1) return true;
  const nonSeed = included.filter(item => !String(item.source || '').includes('seed') && !String(item.source || '').includes('fallback'));
  return included.length < 3 && nonSeed.length === 0;
}


async function runWithTimeout(promise, ms, label) {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`${label || 'Operation'} timed out after ${Math.round(ms / 1000)} seconds.`)), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timeoutId);
  }
}

ipcMain.handle('discover-pages', async (_event, data) => {
  const { chromium } = await import('playwright');
  const { loadConfig } = await import('../src/lib/config.mjs');
  const { discoverPageCandidates } = await import('../src/lib/crawler.mjs');

  const rawOptions = {
    command: 'audit',
    url: data.url || '',
    out: data.out || 'audit/discovery-preview',
    devices: 'desktop-wide',
    maxPages: Math.min(Number(data.maxPages || 80), 80),
    depth: Math.min(Number(data.depth || 2), 2),
    waitMs: Math.min(Number(data.waitMs || 750), 1000),
    pages: data.pages || '',
    include: data.includePaths || '',
    exclude: data.excludePaths || '',
    flagText: '',
    modules: 'visual',
    reportStyle: data.reportStyle || 'quick',
    scopeMode: data.scopeMode === 'crawl' ? 'auto' : (data.scopeMode || 'auto'),
    respectRobots: data.respectRobots !== false,
    menu: false,
    interactions: false,
    acceptCookies: Boolean(data.acceptCookies),
    hideOverlays: Boolean(data.hideOverlays)
  };

  if (!rawOptions.url || !/^https?:\/\//i.test(rawOptions.url)) {
    return { ok: false, message: 'Enter a valid Target URL before discovery.' };
  }

  sendLog(`\nStarting page discovery (${rawOptions.scopeMode})...\n`);
  sendLog(`Target: ${rawOptions.url}\n`);
  sendLog(`Max pages: ${rawOptions.maxPages}; depth: ${rawOptions.depth}\n`);

  const browser = await chromium.launch({ headless: true });
  try {
    const options = await loadConfig(rawOptions);
    const result = await runWithTimeout(
      discoverPageCandidates(browser, options),
      90000,
      'Auto discovery'
    );
    if ((rawOptions.scopeMode === 'auto' || rawOptions.scopeMode === 'crawl') && isLowYieldDiscovery(result)) {
      const reason = `Only ${result.included.length} public page${result.included.length === 1 ? '' : 's'} could be validated. The site may be auth-gated, crawler-resistant, or mostly app-driven.`;
      const fallback = buildFallbackDiscoveryResult(rawOptions.url, reason, 'limited');
      const merged = {
        ...fallback,
        included: [...new Map([...result.included, ...fallback.included].map(item => [item.url, item])).values()].slice(0, rawOptions.maxPages),
        rejected: [...(result.rejected || []), ...fallback.rejected],
        summary: {
          candidates: (result.summary?.candidates || 0) + fallback.summary.candidates,
          included: 0,
          rejected: (result.rejected || []).length + fallback.rejected.length,
          sources: []
        },
        originalIncluded: result.included.length
      };
      merged.summary.included = merged.included.length;
      merged.summary.sources = [...new Set(merged.included.map(item => item.source).filter(Boolean))];
      sendLog(`Discovery limited: ${reason}\n`);
      sendLog(`Discovery fallback: ${merged.included.length} starter/public routes returned.\n`);
      for (const item of merged.included.slice(0, 80)) sendLog(`  + ${item.url} [${item.status || '-'}] ${item.source || ''}\n`);
      return { ok: true, ...merged };
    }

    sendLog(`Discovery complete: ${result.included.length} included, ${result.rejected.length} rejected.\n`);
    for (const item of result.included.slice(0, 80)) {
      sendLog(`  + ${item.url} [${item.status || '-'}] ${item.source || ''}\n`);
    }
    if (result.rejected.length) {
      sendLog(`  Rejected examples:\n`);
      for (const item of result.rejected.slice(0, 25)) sendLog(`  - ${item.url} (${item.reason})\n`);
    }
    return { ok: true, ...result };
  } catch (error) {
    sendLog(`Discovery warning: ${error.message}\n`);
    if (/timed out/i.test(error.message || '')) {
      const fallback = buildFallbackDiscoveryResult(rawOptions.url, error.message);
      sendLog(`Discovery fallback: ${fallback.included.length} starter pages returned.\n`);
      for (const item of fallback.included.slice(0, 20)) sendLog(`  + ${item.url} [fallback]\n`);
      return { ok: true, ...fallback };
    }
    return { ok: false, message: error.message };
  } finally {
    await browser.close().catch(() => {});
  }
});

ipcMain.handle('run-audit', async (_event, data) => {
  if (activeProcess) return { ok: false, message: 'An audit is already running.' };

  const storeBeforeRun = await readStore();
  const outDir = resolveOutputPath(data.out || 'audit/site-ultra', data.url || '', storeBeforeRun.settings?.defaultOutputRoot || '');

  const args = [
    path.join(rootDir, 'bin', 'siteshot.mjs'), 'audit',
    '--url', data.url || '',
    '--out', outDir,
    '--devices', data.devices || 'desktop-wide,laptop,ipad,iphone-pro-max,iphone-se',
    '--max-pages', String(data.maxPages || 200),
    '--depth', String(data.depth || 3),
    '--wait', String(data.waitMs || 2000),
    '--flag-text', data.flagText || '',
    '--modules', data.modules || 'visual,functionality,seo,accessibility,performance,security,privacy,content,technical,auth,forms',
    '--report-style', data.reportStyle || 'full',
    '--scope-mode', data.scopeMode || 'exact',
    '--include', data.includePaths || '',
    '--exclude', data.excludePaths || ''
  ];

  if (data.pages) args.push('--pages', data.pages);
  if (data.menu) args.push('--menu');
  if (data.interactions) args.push('--interactions');
  if (data.acceptCookies) args.push('--accept-cookies');
  if (data.hideOverlays) args.push('--hide-overlays');
  if (data.respectRobots) args.push('--respect-robots');
  else args.push('--no-respect-robots');

  sendLog(`Starting SiteShot Auditor Studio Ultra v${app.getVersion()}...\n`);
  sendLog(`Target: ${data.url}\n`);
  sendLog(`Output: ${outDir}\n`);
  sendLog(`Scope: ${data.scopeMode || 'exact'}\n`);
  sendLog(`Modules: ${data.modules}\n`);
  sendLog(`Devices: ${data.devices}\n\n`);

  activeProcess = spawn(process.execPath, args, {
    cwd: rootDir,
    shell: false,
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }
  });

  activeProcess.stdout.on('data', chunk => sendLog(chunk.toString()));
  activeProcess.stderr.on('data', chunk => sendLog(chunk.toString()));

  activeProcess.on('close', async code => {
    sendLog(`\nAudit finished with code ${code}.\nOutput folder: ${outDir}\n`);

    const payload = await buildReportPayload(outDir, code, data.url || '');
    const available = Object.entries(payload.availableReports)
      .filter(([key]) => ['report', 'quick', 'full', 'client', 'executive', 'technical', 'roadmap', 'gallery', 'pdf', 'docx', 'issuesCsv', 'tickets'].includes(key))
      .map(([key, exists]) => `${key}: ${exists ? 'ready' : 'missing'}`)
      .join(', ');

    sendLog(`Report check: ${available}\n`);
    if (payload.createdFallbacks.length) {
      sendLog(`Recovered missing report files: ${payload.createdFallbacks.join(', ')}\n`);
    }

    activeProcess = null;

    await addRunToStore({
      id: String(Date.now()),
      createdAt: new Date().toISOString(),
      targetUrl: data.url || '',
      outDir,
      code,
      score: payload.summary?.scores?.overall ?? null,
      grade: payload.summary?.scores?.grade ?? null,
      issueCount: payload.summary?.issueCount ?? null,
      report: payload.report,
      quick: payload.quick,
      full: payload.full,
      client: payload.client,
      reportStyle: data.reportStyle || payload.summary?.selectedReportStyle || 'full',
      reportStyleLabel: payload.summary?.selectedReportLabel || reportStyleLabel(data.reportStyle || 'full'),
      executive: payload.executive,
      technical: payload.technical,
      roadmap: payload.roadmap,
      gallery: payload.gallery,
      pdf: payload.pdf,
      docx: payload.docx,
      issuesCsv: payload.issuesCsv,
      tickets: payload.tickets
    });

    mainWindow?.webContents.send('audit-complete', payload);
  });

  return { ok: true, message: 'Audit started.' };
});

ipcMain.handle('stop-audit', async () => {
  if (activeProcess) {
    activeProcess.kill();
    activeProcess = null;
    return { ok: true, message: 'Audit stopped.' };
  }
  return { ok: false, message: 'No audit is running.' };
});

ipcMain.handle('open-path', async (_event, targetPath) => {
  if (!targetPath) return { ok: false, message: 'No path supplied.' };
  const repaired = repairPossiblyEscapedWindowsPath(targetPath);
  const resolved = path.resolve(repaired);
  if (!fs.existsSync(resolved)) return { ok: false, message: `Path does not exist yet: ${resolved}` };
  await shell.openPath(resolved);
  return { ok: true };
});

ipcMain.handle('open-external-file', async (_event, targetPath) => {
  if (!targetPath) return { ok: false, message: 'No file supplied.' };
  const repaired = repairPossiblyEscapedWindowsPath(targetPath);
  const resolved = path.resolve(repaired);

  if (fs.existsSync(resolved)) {
    await shell.openExternal(`file://${resolved.replace(/\\/g, '/')}`);
    return { ok: true, path: resolved };
  }

  const parent = path.dirname(resolved);
  const basename = path.basename(resolved);
  const found = await findSameNamedFile(parent, basename, 2);
  if (found && fs.existsSync(found)) {
    await shell.openExternal(`file://${found.replace(/\\/g, '/')}`);
    return { ok: true, path: found, message: `Opened recovered file: ${found}` };
  }

  if (fs.existsSync(parent)) {
    await shell.openPath(parent);
    return { ok: false, message: `File was not found, so I opened the output folder instead: ${resolved}` };
  }

  return { ok: false, message: `File does not exist yet: ${resolved}` };
});

ipcMain.handle('choose-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory', 'createDirectory'] });
  if (result.canceled || !result.filePaths.length) return null;
  return result.filePaths[0];
});

ipcMain.handle('export-output-zip', async (_event, outDir) => {
  if (!outDir || !fs.existsSync(outDir)) return { ok: false, message: 'No completed output folder found.' };
  const safeBase = outDir.replace(/[\\\/]+$/, '');
  if (process.platform === 'win32') {
    const ps = spawn('powershell.exe', [
      '-NoProfile',
      '-ExecutionPolicy', 'Bypass',
      '-Command',
      `Compress-Archive -Path "${outDir}\\*" -DestinationPath "${safeBase}.zip" -Force`
    ], { shell: false });

    await new Promise((resolve, reject) => {
      ps.on('close', code => code === 0 ? resolve() : reject(new Error(`Compress-Archive failed with code ${code}`)));
      ps.on('error', reject);
    });

    return { ok: true, path: `${safeBase}.zip` };
  }
  return { ok: false, message: 'Export zip is currently supported on Windows builds.' };
});


ipcMain.handle('open-help-docs', async () => {
  const candidates = [
    path.join(rootDir, 'README FIRST - WINDOWS.txt'),
    path.join(rootDir, 'README.md'),
    path.join(rootDir, 'docs'),
    rootDir
  ];
  for (const target of candidates) {
    if (fs.existsSync(target)) {
      await shell.openPath(target);
      return { ok: true, path: target };
    }
  }
  return { ok: false, message: 'No help documentation was found in the app folder.' };
});

ipcMain.handle('get-version', async () => app.getVersion());
ipcMain.handle('get-store', async () => await readStore());

ipcMain.handle('save-project', async (_event, project) => {
  const store = await readStore();
  const item = { id: project.id || String(Date.now()), createdAt: project.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString(), ...project };
  store.projects = [item, ...(store.projects || []).filter(p => p.id !== item.id)].slice(0, 100);
  await writeStore(store);
  return { ok: true, store };
});

ipcMain.handle('save-template', async (_event, template) => {
  const store = await readStore();
  const item = { id: template.id || String(Date.now()), createdAt: template.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString(), ...template };
  store.templates = [item, ...(store.templates || []).filter(t => t.id !== item.id)].slice(0, 100);
  await writeStore(store);
  return { ok: true, store };
});

ipcMain.handle('delete-store-item', async (_event, kind, id) => {
  const store = await readStore();
  if (['runs', 'projects', 'templates'].includes(kind)) {
    store[kind] = (store[kind] || []).filter(item => item.id !== id);
    await writeStore(store);
    return { ok: true, store };
  }
  return { ok: false, message: 'Unknown store item type.' };
});


ipcMain.handle('delete-run', async (_event, id, deleteFiles = false) => {
  const store = await readStore();
  const run = (store.runs || []).find(item => item.id === id);
  if (!run) return { ok: false, message: 'Run not found.' };

  let filesDeleted = false;
  if (deleteFiles && run.outDir) {
    filesDeleted = await deletePathSafe(run.outDir);
  }

  store.runs = (store.runs || []).filter(item => item.id !== id);
  await writeStore(store);
  return { ok: true, store, filesDeleted };
});

ipcMain.handle('bulk-delete-runs', async (_event, ids = [], deleteFiles = false) => {
  const wanted = new Set(ids);
  const store = await readStore();
  const runs = store.runs || [];
  const selectedRuns = runs.filter(item => wanted.has(item.id));

  let deletedFolders = 0;
  if (deleteFiles) {
    for (const run of selectedRuns) {
      if (run.outDir && await deletePathSafe(run.outDir)) deletedFolders += 1;
    }
  }

  store.runs = runs.filter(item => !wanted.has(item.id));
  await writeStore(store);
  return { ok: true, store, deletedCount: selectedRuns.length, deletedFolders };
});

ipcMain.handle('save-settings', async (_event, settings) => {
  const store = await readStore();
  store.settings = { ...(store.settings || {}), ...(settings || {}) };
  await writeStore(store);
  return { ok: true, store };
});

ipcMain.handle('window-action', async (_event, action) => {
  if (!mainWindow) return { ok: false };
  if (action === 'minimize') mainWindow.minimize();
  if (action === 'maximize') {
    if (mainWindow.isMaximized()) mainWindow.unmaximize();
    else mainWindow.maximize();
  }
  if (action === 'close') mainWindow.close();
  if (action === 'settings') mainWindow.webContents.send('switch-view', 'settings');
  return { ok: true };
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (activeProcess) activeProcess.kill();
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
