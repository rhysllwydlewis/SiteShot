import fs from 'node:fs';
import vm from 'node:vm';

let failed = false;

function check(ok, label) {
  console.log(`${ok ? 'OK' : 'FAIL'} - ${label}`);
  if (!ok) failed = true;
}

function read(file) {
  return fs.readFileSync(file, 'utf8');
}

function hasNsisTarget(targets) {
  return Array.isArray(targets) && targets.some(target => {
    if (typeof target === 'string') return target === 'nsis';
    return target?.target === 'nsis';
  });
}

function hasDirTarget(targets) {
  return Array.isArray(targets) && targets.some(target => {
    if (typeof target === 'string') return target === 'dir';
    return target?.target === 'dir';
  });
}

const requiredFiles = [
  'package.json',
  'desktop/main.mjs',
  'desktop/preload.cjs',
  'desktop/index.html',
  'bin/siteshot.mjs',
  'src/audit.mjs',
  'src/lib/config.mjs',
  'src/lib/devices.mjs',
  'src/lib/crawler.mjs',
  'src/lib/capture.mjs',
  'src/lib/playwright-runtime.mjs',
  'src/modules/security.mjs',
  'src/modules/accessibility.mjs',
  'src/modules/performance.mjs',
  'src/modules/auth.mjs',
  'src/modules/forms.mjs',
  'src/reporting/reports.mjs',
  'scripts/installer-smoke-check.mjs',
  'BUILD WINDOWS INSTALLER.bat',
  '.github/workflows/build-windows-exe.yml',
  '.github/workflows/release-windows.yml'
];

for (const file of requiredFiles) check(fs.existsSync(file), file);

const pkg = JSON.parse(read('package.json'));
const build = pkg.build || {};
const win = build.win || {};
const nsis = build.nsis || {};
const scripts = pkg.scripts || {};
const winTargets = win.target || [];

check(pkg.version === '3.2.23', 'package version is 3.2.23');
check(!pkg.dependencies?.electron, 'electron not in dependencies');
check(Boolean(pkg.devDependencies?.electron), 'electron in devDependencies');
check(Boolean(pkg.devDependencies?.['electron-builder']), 'electron-builder in devDependencies');
check(Boolean(pkg.dependencies?.playwright), 'playwright in dependencies');
check(Boolean(pkg.devDependencies?.['cross-env']), 'cross-env in devDependencies');

check(build.appId === 'uk.siteshot.auditorstudio', 'stable appId');
check(build.productName === 'SiteShot Auditor Studio', 'stable productName');
check(build.artifactName === 'install.${ext}', 'installer output is install.exe');
check(build.directories?.output === 'release', 'installer output directory is release');
check(build.asar === false, 'asar disabled for packaged audit engine access');

check(Boolean(build.nsis), 'NSIS config present');
check(hasNsisTarget(winTargets), 'NSIS installer target present');
check(!hasDirTarget(winTargets), 'no separate dir target exposed as release package');
check(win.requestedExecutionLevel === 'asInvoker', 'Windows app runs asInvoker by default');
check(nsis.oneClick === false, 'installer uses guided install mode');
check(nsis.perMachine === false, 'installer defaults to per-user install');
check(nsis.allowToChangeInstallationDirectory === true, 'installer allows install directory selection');
check(nsis.createDesktopShortcut === 'always', 'installer creates desktop shortcut');
check(nsis.createStartMenuShortcut === true, 'installer creates Start Menu shortcut');
check(nsis.shortcutName === 'SiteShot Auditor Studio', 'installer shortcut name matches product');
check(nsis.runAfterFinish === true, 'installer can launch app after install');
check(nsis.deleteAppDataOnUninstall === false, 'uninstall preserves user audit data by default');

check(typeof scripts['install:browsers:bundled'] === 'string' && scripts['install:browsers:bundled'].includes('PLAYWRIGHT_BROWSERS_PATH=playwright-browsers'), 'bundled Playwright install script targets playwright-browsers');
check(typeof scripts['dist:installer'] === 'string' && scripts['dist:installer'].includes('install:browsers:bundled'), 'installer build bundles Playwright browser runtime');
check(typeof scripts['dist:installer'] === 'string' && scripts['dist:installer'].includes('electron-builder --win nsis --x64'), 'installer build runs Electron Builder NSIS x64');
check(typeof scripts.verify === 'string' && scripts.verify.includes('npm run preflight'), 'verify runs preflight');

const packagedFiles = Array.isArray(build.files) ? build.files : [];
for (const packagedFile of [
  'desktop/**/*',
  'src/**/*',
  'bin/**/*',
  'docs/**/*',
  'scripts/**/*',
  'package.json',
  'README.md',
  'README FIRST - WINDOWS.txt'
]) {
  check(packagedFiles.includes(packagedFile), `packaged file rule: ${packagedFile}`);
}
check(!packagedFiles.includes('node_modules/playwright-core/.local-browsers/**/*'), 'browser runtime is not packaged from node_modules local-browsers');

const extraResources = Array.isArray(build.extraResources) ? build.extraResources : [];
check(extraResources.some(resource => resource?.from === 'playwright-browsers' && resource?.to === 'playwright-browsers'), 'playwright-browsers packaged as extraResources');

const main = read('desktop/main.mjs');
const preload = read('desktop/preload.cjs');
const html = read('desktop/index.html');
const audit = read('src/audit.mjs');
const crawler = read('src/lib/crawler.mjs');
const capture = read('src/lib/capture.mjs');
const reports = read('src/reporting/reports.mjs');
const runtime = read('src/lib/playwright-runtime.mjs');
const buildWorkflow = read('.github/workflows/build-windows-exe.yml');
const releaseWorkflow = read('.github/workflows/release-windows.yml');
const installerBatch = read('BUILD WINDOWS INSTALLER.bat');

check(runtime.includes('resourcesBrowserPath'), 'runtime checks Electron resources browser path');
check(runtime.includes('playwright-browsers'), 'runtime uses playwright-browsers folder');
check(runtime.includes('hasChromiumBrowser'), 'runtime verifies Chromium exists before using path');
check(main.includes('ELECTRON_RUN_AS_NODE'), 'packaged EXE uses Node mode for audit runner');
check(main.includes('discover-pages'), 'main handles page discovery');
check(main.includes('open-help-docs'), 'main handles help docs');
check(main.includes('repairPossiblyEscapedWindowsPath'), 'defensive Windows path repair exists');
check(main.includes('ensureFallbackReports'), 'fallback report generation exists');

for (const fn of [
  'runAudit',
  'discoverPages',
  'stopAudit',
  'openPath',
  'openExternalFile',
  'chooseFolder',
  'exportOutputZip',
  'getVersion',
  'getStore',
  'saveProject',
  'saveTemplate',
  'deleteStoreItem',
  'deleteRun',
  'bulkDeleteRuns',
  'saveSettings',
  'windowAction',
  'openHelpDocs'
]) {
  check(preload.includes(fn), `preload exposes ${fn}`);
}

const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);
if (scriptMatch) {
  try {
    new vm.Script(scriptMatch[1], { filename: 'desktop/index.html:inline-script.js' });
    check(true, 'browser script syntax check passes');
  } catch (error) {
    check(false, `browser script syntax check failed: ${error.message}`);
  }
} else {
  check(false, 'browser script block exists');
}

for (const id of ['run', 'stop', 'choose', 'openReport', 'openQuick', 'openFull', 'openFolder', 'exportZip', 'url', 'out', 'pages', 'permission', 'versionPill', 'topVersion', 'settingsVersion', 'discoveryPanel', 'discoveryList', 'scopeHelp']) {
  check(html.includes(`id="${id}"`), `UI id ${id}`);
}

check(html.includes('id="topVersion">v3.2.23'), 'visible top version is 3.2.23');
check(html.includes("scopeMode = 'exact'"), 'Exact Pages is default scope mode');
check(html.includes('data-scope="exact">Exact pages') && html.includes('data-scope="auto">Auto') && html.includes('data-scope="sitemap">Sitemap'), 'Exact/Auto/Sitemap tabs exist');
check(!html.includes('Crawl website'), 'Crawl Website tab removed from UI');
check(html.includes('function startDiscoveryForScope'), 'Auto/Sitemap auto discovery handler exists');
check(html.includes('function setScopeTabBusy') && html.includes('scope-loading'), 'Auto/Sitemap tab busy state exists');
check(html.includes('const latestRun=[...runs].sort'), 'Last Run uses newest createdAt run');

check(audit.includes("version: '3.2.23'"), 'manifest writes current version');
check(audit.includes('No valid devices selected'), 'audit validates device selection');
check(capture.includes('runAuthModule') && capture.includes('runFormsModule'), 'auth/forms modules imported by capture engine');
check(capture.includes('moduleData.auth') && capture.includes('moduleData.forms'), 'auth/forms module results saved by capture engine');
check(crawler.includes('resolveExplicitPage'), 'exact page route resolver exists');
check(crawler.includes('collectSitemapCandidates'), 'sitemap discovery exists');
check(crawler.includes('crawlCandidates'), 'crawl discovery exists');
check(crawler.includes('async function revealNavigationControls'), 'crawler reveals navigation controls');
check(reports.includes('quick-report.html'), 'quick report output exists');
check(reports.includes('full-report.html'), 'full professional report output exists');
check(reports.includes('report.html'), 'selected report alias output exists');
check(reports.includes('dedupeIssues'), 'report globally de-duplicates issues');

check(buildWorkflow.includes('name: Build Windows Installer'), 'build workflow has installer name');
check(buildWorkflow.includes('npm run dist:installer'), 'build workflow builds installer');
check(buildWorkflow.includes('release/install.exe'), 'build workflow uploads install.exe');
check(!buildWorkflow.includes('Windows-Unpacked'), 'build workflow does not upload unpacked package');
check(releaseWorkflow.includes('npm run dist:installer'), 'release workflow builds installer');
check(releaseWorkflow.includes('release/install.exe'), 'release workflow publishes install.exe');
check(!releaseWorkflow.includes('Windows-Unpacked'), 'release workflow does not publish unpacked package');
check(installerBatch.includes('npm.cmd run verify'), 'installer batch runs verify before building');
check(installerBatch.includes('npm.cmd run dist:installer'), 'installer batch builds the setup installer');
check(installerBatch.includes('release\\install.exe'), 'installer batch expects release\\install.exe');

if (failed) process.exit(1);
console.log('Preflight passed.');
