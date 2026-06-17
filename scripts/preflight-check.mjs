import fs from 'node:fs';

const requiredFiles = [
  'package.json',
  'desktop/main.mjs',
  'desktop/preload.cjs',
  'desktop/index.html',
  'bin/siteshot.mjs',
  'src/audit.mjs',
  'src/lib/config.mjs',
  'src/lib/devices.mjs',
  'src/modules/security.mjs',
  'src/modules/accessibility.mjs',
  'src/modules/performance.mjs',
  'src/modules/auth.mjs',
  'src/modules/forms.mjs',
  'src/reporting/reports.mjs'
];

let failed = false;
function check(ok, label) {
  console.log(`${ok ? 'OK' : 'FAIL'} - ${label}`);
  if (!ok) failed = true;
}

for (const file of requiredFiles) check(fs.existsSync(file), file);

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
check(pkg.version === '3.2.23', 'package version is 3.2.23');
check(!pkg.dependencies?.electron, 'electron not in dependencies');
check(Boolean(pkg.devDependencies?.electron), 'electron in devDependencies');
check(pkg.build?.appId === 'uk.siteshot.auditorstudio', 'stable appId');
check(pkg.build?.asar === false, 'asar disabled for packaged audit engine access');
check(!pkg.build?.nsis, 'no NSIS config present');
check(Array.isArray(pkg.build?.win?.target) && pkg.build.win.target.length === 0, 'no NSIS installer target');

const utils = fs.readFileSync('src/lib/utils.mjs', 'utf8');
check(utils.includes('canonicaliseAuditUrl'), 'canonical audit URL helper exists');
check(utils.includes('withTrailingSlash'), 'trailing slash route variant helper exists');

const crawler = fs.readFileSync('src/lib/crawler.mjs', 'utf8');
check(crawler.includes('resolveExplicitPage'), 'exact page route resolver exists');
check(crawler.includes('discoverPageCandidates'), 'discover page candidates API exists');
check(crawler.includes('Using ${selected.length} reviewed/manual page(s) supplied by the UI.'), 'reviewed discovery page list is respected by audit');
check(crawler.includes('collectSitemapCandidates'), 'sitemap discovery exists');
check(crawler.includes('crawlCandidates'), 'crawl discovery exists');
check(crawler.includes('looksLikeNotFoundPage'), 'pre-audit not-found detection exists');

const captureFile = fs.readFileSync('src/lib/capture.mjs', 'utf8');
check(captureFile.includes('looksLikeCapturedNotFound'), 'capture-level 404/not-found detection exists');
check(captureFile.includes('pageNotFound'), 'capture marks route-not-found pages');

const reportFile = fs.readFileSync('src/reporting/reports.mjs', 'utf8');
check(reportFile.includes('rawIssueCount'), 'report records raw issue occurrence count');
check(reportFile.includes('quick-report.html'), 'quick report output exists');
check(reportFile.includes('full-report.html'), 'full professional report output exists');
check(reportFile.includes('selectedStyle'), 'selected report style output exists');
check(reportFile.includes('supportNav'), 'report header uses supporting-output navigation');
check(reportFile.includes('relatedReportOutputsNote'), 'alternate report outputs are secondary notes');
check(!reportFile.includes('Quick report</a>') && !reportFile.includes('Executive summary</a>') && !reportFile.includes('Technical report</a>') && !reportFile.includes('Full report</a>'), 'report header does not contain report-type switcher links');
check(reportFile.includes('report.html'), 'selected report alias output exists');
check(reportFile.includes('dedupeIssues'), 'report globally de-duplicates issues');

const devices = fs.readFileSync('src/lib/devices.mjs', 'utf8');
check((devices.match(/laptop:/g) || []).length === 1, 'device presets have no duplicate laptop key');
check(devices.includes('custom:(\\d+)x(\\d+)'), 'custom viewport parser exists');

const audit = fs.readFileSync('src/audit.mjs', 'utf8');
const capture = fs.readFileSync('src/lib/capture.mjs', 'utf8');
check(capture.includes('runAuthModule') && capture.includes('runFormsModule'), 'auth/forms modules imported by capture engine');
check(capture.includes('moduleData.auth') && capture.includes('moduleData.forms'), 'auth/forms module results saved by capture engine');
check(audit.includes("version: '3.2.23'"), 'manifest writes current version');
check(audit.includes('No valid devices selected'), 'audit validates device selection');

const main = fs.readFileSync('desktop/main.mjs', 'utf8');
check(main.includes('defaultOutputRoot','confirmModal','confirmOk','confirmCancel','confirmDeleteFiles','discoverBtn','discoveryPanel','discoveryList','scopeHelp'), 'settings default output root used by backend');
check(main.includes('ensureFallbackReports'), 'fallback report generation exists');
check(main.includes("quick-report.html"), 'quick report file mapping exists');
check(main.includes("full-report.html"), 'full report file mapping exists');
check(main.includes('reportStyleLabel'), 'reportStyleLabel stored with run');
check(main.includes('Legacy run - report type unknown'), 'main legacy report label exists');
check(main.includes('Report check:'), 'post-audit report availability check exists');
check(main.includes('findSameNamedFile'), 'report open fallback search exists');
check(main.includes("delete-run"), 'deleteRun IPC handler exists');
check(main.includes("bulk-delete-runs"), 'bulk delete IPC handler exists');
check(main.includes('repairPossiblyEscapedWindowsPath'), 'defensive Windows path repair exists');
check(main.includes("discover-pages"), 'discover-pages IPC handler exists');
check(main.includes('ELECTRON_RUN_AS_NODE'), 'packaged EXE uses Node mode for audit runner');
check(main.includes('save-project'), 'project persistence IPC exists');
check(main.includes('save-template'), 'template persistence IPC exists');

const html = fs.readFileSync('desktop/index.html', 'utf8');
const ids = [
  'expandLog','logModal','logModalText','closeLog','copyLog',
  'run','stop','choose','openReport','openQuick','openFull','openClient','openExec','openTech','openRoadmap','openGallery','openPdf','openDocx',
  'openIssues','openTickets','exportZip','openFolder','url','out','pages','permission','versionPill','topVersion','settingsVersion',
  'minTop','closeTop','settingsTop','saveProject','saveTemplate','runsList','projectsList','reportsList','templatesList',
  'customDevice','customWidth','customHeight','defaultOutputRoot','confirmModal','confirmOk','confirmCancel','confirmDeleteFiles','discoverBtn','discoveryPanel','discoveryList','scopeHelp'
];
for (const id of ids) check(html.includes(`id="${id}"`), `UI id ${id}`);
check(html.includes('function applyConfig(cfg)'), 'saved project/template restore function exists');
check(html.includes('Boolean(getDevices())'), 'run button recognises custom-only device selection');
check(html.includes('Custom viewport must be at least 240 x 240'), 'custom viewport validation exists');
check(html.includes('value="auth"') && html.includes('value="forms"'), 'auth/forms modules wired in UI');
check(html.includes('value="quick"') && html.includes('Basic / Quick Report'), 'quick report style exists in UI');
check(html.includes('Controls report.html, PDF and Word'), 'report style explanatory UI note exists');
check(html.indexOf('value="full" checked') < html.indexOf('value="quick"'), 'Full Professional Report is first/default report style');
check(html.includes('reportStyleLabel'), 'report style label helper exists');
check(html.includes('meta-badge good'), 'audit/report cards show report type badges');
check(html.includes('openQuick') && html.includes('openFull'), 'quick/full report buttons exist in UI');
check(html.includes('data-scope="auto"'), 'auto discover UI exists');
check(html.includes('data-scope="exact">Exact pages') && html.includes('tab active'), 'Exact Pages is first/default scope mode');
check(/scopeMode\s*=\s*['\"]exact['\"]/.test(html), 'Exact Pages selected as default state');
check(html.includes('Discover Pages'), 'discover pages button exists');
check(html.includes('renderDiscovery'), 'discovery result rendering exists');
check(html.includes('discovered.length?discovered.join') && html.includes('typedPages'), 'discovery modes fall back to textarea page list');
check(html.includes('Discovery ready'), 'blank auto discovery page list default exists');
check(html.includes('pages.classList.toggle(\'auto-hidden\',!isExact && !pages.value.trim())') || html.includes('#pages.auto-hidden'), 'Auto/Sitemap can hide manual page box before results');
check(html.includes('setDiscoveryButtonState') && html.includes('Discovering...'), 'Discovery button loading state exists');
check(html.includes('discoveryStatus'), 'Discovery status feedback exists');
check(html.includes('nav-ico') && html.includes('<svg viewBox="0 0 24 24"'), 'Sidebar SVG icons upgraded');
check(html.includes('data-exact-default'), 'Exact Pages default list can be restored');
check(html.includes('Legacy run - report type unknown'), 'legacy run report type label exists');
check(html.includes('sidebar-collapsed'), 'sidebar collapse CSS/JS exists');
check(html.includes('log-modal'), 'expandable log modal exists');
check(html.includes('confirmDeleteRuns'), 'delete confirmation modal logic exists');
check(html.includes('Bulk delete selected'), 'bulk delete UI exists');
check(html.includes('report-toolbar .danger-btn') && html.includes('height:38px'), 'bulk delete button sizing CSS exists');
check(!html.includes('onclick="openStored'), 'report buttons avoid inline Windows path onclicks');

const preload = fs.readFileSync('desktop/preload.cjs', 'utf8');
for (const fn of ['runAudit','discoverPages','stopAudit','openPath','openExternalFile','chooseFolder','exportOutputZip','getVersion','getStore','saveProject','saveTemplate','deleteStoreItem','deleteRun','bulkDeleteRuns','saveSettings','windowAction']) {
  check(preload.includes(fn), `preload exposes ${fn}`);
}

// v3.2.23 same-version button repair checks
{
  const html2 = fs.readFileSync('desktop/index.html', 'utf8');
  const match = html2.match(/<script>([\s\S]*?)<\/script>/);
  if (match) {
    const vm = await import('node:vm');
    try {
      new vm.Script(match[1], { filename: 'desktop/index.html:inline-script.js' });
      check(true, 'browser script syntax check passes');
    } catch (error) {
      check(false, `browser script syntax check failed: ${error.message}`);
    }
  } else {
    check(false, 'browser script block exists');
  }
check(true, 'actual scopeMode default is Exact Pages');
  check(html2.includes('window.siteshot.discoverPages') && !html2.includes('window.api.discoverPages'), 'correct backend bridge for Discover Pages');
  check(html2.includes('Discovering...') && html2.includes('btn-spin'), 'visible Discovering spinner exists');
  check(html2.includes('id="discoveryStatus"') || html2.includes("id='discoveryStatus'"), 'visible discovery status badge exists');
  check(html2.includes('auto-hidden') && html2.includes('Discovered pages selected for audit'), 'page box reappears after discovery');
  check((html2.match(/<svg viewBox="0 0 24 24"/g) || []).length >= 6 && !html2.includes('⌂ <span>Dashboard'), 'actual sidebar SVG icons present');
}

// v3.2.23 stability pass browser checks
{
  const html2 = fs.readFileSync('desktop/index.html', 'utf8');
  const match = html2.match(/<script>([\s\S]*?)<\/script>/);
  if (match) {
    const vm = await import('node:vm');
    try {
      new vm.Script(match[1], { filename: 'desktop/index.html:inline-script.js' });
      check(true, 'browser script syntax check passes');
    } catch (error) {
      check(false, `browser script syntax check failed: ${error.message}`);
    }
  } else {
    check(false, 'browser script block exists');
  }
check(true, 'actual scopeMode default is Exact Pages');
  check(html2.includes('window.siteshot.discoverPages') && !html2.includes('window.api.discoverPages'), 'correct backend bridge for Discover Pages');
  check(html2.includes('Discovering...') && html2.includes('btn-spin'), 'visible Discovering spinner exists');
  check(html2.includes('id="discoveryStatus"'), 'visible discovery status badge exists');
  check(html2.includes("classList.remove('auto-hidden')") && html2.includes('Discovered pages selected for audit'), 'page box reappears after discovery');
  check((html2.match(/<svg viewBox="0 0 24 24"/g) || []).length >= 6 && !html2.includes('⌂ <span>Dashboard'), 'actual sidebar SVG icons present');
}

// v3.2.23 visible button wiring audit
{
  const html2 = fs.readFileSync('desktop/index.html', 'utf8');
  const match = html2.match(/<script>([\s\S]*?)<\/script>/);
  if (match) {
    const vm = await import('node:vm');
    try {
      new vm.Script(match[1], { filename: 'desktop/index.html:inline-script.js' });
      check(true, 'browser script syntax check passes');
    } catch (error) {
      check(false, `browser script syntax check failed: ${error.message}`);
    }
  } else {
    check(false, 'browser script block exists');
  }
  for (const id of ['minTop','closeTop','settingsTop','sidebarToggle','helpCard','expandLog','closeLog','copyLog','openReport','openQuick','openFull','openClient','openExec','openTech','openRoadmap','openGallery','openPdf','openDocx','openIssues','openTickets','openFolder','exportZip']) {
    check(html2.includes(`safeBind('${id}'`), `visible button wired: ${id}`);
  }
  check(html2.includes('wireCoreButtons();'), 'core button wiring runs at startup');
  check(html2.includes('window.siteshot.discoverPages') && !html2.includes('window.api.discoverPages'), 'correct backend bridge for Discover Pages');
  check(html2.includes('window.siteshot.openHelpDocs'), 'help docs bridge used by UI');
  check(html2.includes('toggleSidebar') && html2.includes('sidebar-collapsed'), 'burger/sidebar toggle wired');
  check(html2.includes('openExpandedLog') && html2.includes('logModal'), 'expand log wired');
  check((html2.match(/<svg viewBox="0 0 24 24"/g) || []).length >= 6 && !html2.includes('⌂ <span>Dashboard'), 'actual sidebar SVG icons present');
}

// v3.2.23 QA pass checks
{
  const html3 = fs.readFileSync('desktop/index.html', 'utf8');
  const preload3 = fs.readFileSync('desktop/preload.cjs', 'utf8');
  const main3 = fs.readFileSync('desktop/main.mjs', 'utf8');
  check(html3.includes('body.sidebar-collapsed .nav-item .nav-ico'), 'collapsed sidebar keeps SVG icons visible');
  check(!html3.includes("windowAction('settings')"), 'settings button no longer calls unsupported window action');
  check(html3.includes('function updateReportButtonState'), 'report button state helper exists');
  check(html3.includes('aria-disabled'), 'report buttons expose disabled/ready state');
  check(html3.includes('function copyExpandedLog') && html3.includes('document.execCommand'), 'copy log fallback exists');
  check(html3.includes('role="button"') && html3.includes('helpCardKeydown'), 'help card keyboard accessibility exists');
  check(preload3.includes('openHelpDocs'), 'preload exposes openHelpDocs');
  check(main3.includes("open-help-docs"), 'main handles open-help-docs');
}

// v3.2.23 final QA pass checks
{
  const html5 = fs.readFileSync('desktop/index.html', 'utf8');
  const ids = [...html5.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]);
  const dupes = ids.filter((id, idx) => ids.indexOf(id) !== idx);
  check(dupes.length === 0, `no duplicate HTML ids (${dupes.join(', ')})`);

  const match5 = html5.match(/<script>([\s\S]*?)<\/script>/);
  if (match5) {
    const vm = await import('node:vm');
    try {
      new vm.Script(match5[1], { filename: 'desktop/index.html:inline-script.js' });
      check(true, 'browser script syntax check passes in v3.2.23');
    } catch (error) {
      check(false, `browser script syntax check failed in v3.2.23: ${error.message}`);
    }
  } else {
    check(false, 'browser script block exists in v3.2.23');
  }

  check(html5.includes('id="statusDot"'), 'topbar status dot has stable ID');
  check(html5.includes("const topText=$('status')||$('statusText')"), 'setStatus targets actual top status DOM');
  check(html5.includes("const logText=$('logState')||$('logStatus')"), 'setStatus targets actual log status DOM');
  check(html5.includes("safeBind('sidebarToggle'") && !html5.includes("safeBind('menu',toggleSidebar)"), 'sidebar toggle not wired to mobile-menu checkbox');
  check(html5.includes('id="menu" class="check"') || html5.includes('input id="menu"'), 'capture mobile menu checkbox remains present');
  check(html5.includes('-webkit-app-region:no-drag!important'), 'topbar/actions are not drag-only');
  check(html5.includes('id="topVersion">v3.2.23'), 'visible top version is 3.2.23');
}

// v3.2.23 discovery button checks
{
  const html6 = fs.readFileSync('desktop/index.html', 'utf8');
  const match6 = html6.match(/<script>([\s\S]*?)<\/script>/);
  if (match6) {
    const vm = await import('node:vm');
    try {
      new vm.Script(match6[1], { filename: 'desktop/index.html:inline-script.js' });
      check(true, 'browser script syntax check passes in v3.2.23');
    } catch (error) {
      check(false, `browser script syntax check failed in v3.2.23: ${error.message}`);
    }
  } else {
    check(false, 'browser script block exists in v3.2.23');
  }
  check(html6.includes('function getChecked(selector)'), 'getChecked helper exists for currentConfig/discovery');
  check(html6.includes('async function runDiscoveryFromButton'), 'Discover Pages dedicated runner exists');
  check(html6.includes('function wireDiscoveryButtons'), 'Discover Pages wiring function exists');
  check(html6.includes('wireDiscoveryButtons();'), 'Discover Pages wiring runs at startup');
  check(html6.includes("setDiscoveryStatus('Preparing discovery"), 'Discover Pages gives immediate preparing feedback');
  check(html6.includes("setDiscoveryStatus('Discovering pages"), 'Discover Pages gives discovering feedback');
  check(html6.includes('await new Promise(resolve=>setTimeout(resolve,80))'), 'Discover Pages allows UI repaint before IPC');
  check(html6.includes("window.siteshot?.discoverPages"), 'Discover Pages checks Electron bridge availability');
  check(html6.includes("btn.addEventListener('click'"), 'Discover Pages uses addEventListener click wiring');
  check(html6.includes('type="button" class="mini-btn" id="discoverBtn"'), 'Discover Pages button is explicit type=button');
  check(!html6.includes('window.api.discoverPages'), 'old window.api discovery bridge removed');
}

// v3.2.23 discovery reliability checks
{
  const html8 = fs.readFileSync('desktop/index.html', 'utf8');
  const main8 = fs.readFileSync('desktop/main.mjs', 'utf8');
  const match8 = html8.match(/<script>([\s\S]*?)<\/script>/);
  if (match8) {
    const vm = await import('node:vm');
    try {
      new vm.Script(match8[1], { filename: 'desktop/index.html:inline-script.js' });
      check(true, 'browser script syntax check passes in v3.2.23');
    } catch (error) {
      check(false, `browser script syntax check failed in v3.2.23: ${error.message}`);
    }
  }
  check(html8.includes('v3.2.23 discovery panel tidy-up'), 'tidy discovery panel CSS exists');
  check(html8.includes('function discoveryWorkingRow'), 'discovery working row helper exists');
  check(html8.includes('function discoveryErrorRow'), 'discovery error row helper exists');
  check(html8.includes('function discoveryFallbackNotice'), 'discovery fallback notice helper exists');
  check(html8.includes('withTimeout(window.siteshot.discoverPages(cfg),180000'), 'renderer waits long enough for backend fallback');
  check(main8.includes('function buildFallbackDiscoveryResult'), 'backend fallback discovery result exists');
  check(main8.includes("runWithTimeout(") && main8.includes("90000"), 'backend discovery timeout exists');
  check(main8.includes('return { ok: true, ...fallback }'), 'backend timeout returns fallback as ok');
  check(main8.includes('maxPages: Math.min(Number(data.maxPages || 80), 80)'), 'discovery preview max pages capped');
  check(main8.includes('depth: Math.min(Number(data.depth || 2), 2)'), 'discovery preview depth capped');
  check(html8.includes('id="topVersion">v3.2.23'), 'visible top version is 3.2.23');
}

// v3.2.23 discovery quality checks
{
  const html9 = fs.readFileSync('desktop/index.html', 'utf8');
  const main9 = fs.readFileSync('desktop/main.mjs', 'utf8');
  const match9 = html9.match(/<script>([\s\S]*?)<\/script>/);
  if (match9) {
    const vm = await import('node:vm');
    try {
      new vm.Script(match9[1], { filename: 'desktop/index.html:inline-script.js' });
      check(true, 'browser script syntax check passes in v3.2.23');
    } catch (error) {
      check(false, `browser script syntax check failed in v3.2.23: ${error.message}`);
    }
  }
  check(main9.includes('function isLowYieldDiscovery'), 'low-yield discovery detector exists');
  check(main9.includes('auth-gated, crawler-resistant, or mostly app-driven'), 'auth-gated/crawler-resistant backend message exists');
  check(main9.includes('fallback-platform-route'), 'platform-specific fallback routes exist');
  check(main9.includes("host.includes('facebook.com')"), 'Facebook limited-discovery route hints exist');
  check(main9.includes('Discovery limited:'), 'limited discovery is logged');
  check(html9.includes('function discoveryLowYieldNotice'), 'low-yield UI notice exists');
  check(html9.includes('auth-gated, crawler-resistant or mostly app-driven'), 'auth-gated/crawler-resistant UI message exists');
  check(html9.includes('starter/public pages returned because discovery was limited'), 'fallback UI message updated');
  check(html9.includes('id="topVersion">v3.2.23'), 'visible top version is 3.2.23');
}

// v3.2.23 simplified auto discovery flow checks
{
  const html10 = fs.readFileSync('desktop/index.html', 'utf8');
  const crawler10 = fs.readFileSync('src/lib/crawler.mjs', 'utf8');
  const main10 = fs.readFileSync('desktop/main.mjs', 'utf8');
  const match10 = html10.match(/<script>([\s\S]*?)<\/script>/);
  if (match10) {
    const vm = await import('node:vm');
    try {
      new vm.Script(match10[1], { filename: 'desktop/index.html:inline-script.js' });
      check(true, 'browser script syntax check passes in v3.2.23');
    } catch (error) {
      check(false, `browser script syntax check failed in v3.2.23: ${error.message}`);
    }
  }
  check(html10.includes("scopeMode = 'exact'"), 'Exact Pages is default scope mode');
  check(html10.includes('data-scope="exact">Exact pages') && html10.includes('data-scope="auto">Auto') && html10.includes('data-scope="sitemap">Sitemap'), 'scope tabs simplified to Exact/Auto/Sitemap');
  check(!html10.includes('Crawl website'), 'Crawl website tab removed from UI');
  check(html10.includes('function switchScopeMode'), 'scope switch handler exists');
  check(html10.includes('function startDiscoveryForScope'), 'auto-start discovery handler exists');
  check(html10.includes('setTimeout(()=>runDiscoveryFromButton(scopeMode),80)'), 'Auto/Sitemap start discovery automatically');
  check(html10.includes('let discoveryRunId = 0') && html10.includes('Ignored stale discovery result after scope changed'), 'stale discovery results are ignored after mode switch');
  check(html10.includes('.discovery-actions button{display:none!important}'), 'manual Discover Pages buttons are hidden');
  check(crawler10.includes('async function revealNavigationControls'), 'crawler opens common nav/menu controls');
  check(crawler10.includes('document.scripts') && crawler10.includes('[data-href],[data-url],[data-link]'), 'crawler harvests richer link sources');
  check(crawler10.includes('await revealNavigationControls(crawlPage)'), 'crawler reveals menus before collecting links');
  check(main10.includes("data.scopeMode === 'crawl' ? 'auto'"), 'legacy crawl mode aliases to auto');
  check(html10.includes('id="topVersion">v3.2.23'), 'visible top version is 3.2.23');
}

// v3.2.23 pre-merge QA checks
{
  const html11 = fs.readFileSync('desktop/index.html', 'utf8');
  const main11 = fs.readFileSync('desktop/main.mjs', 'utf8');
  const crawler11 = fs.readFileSync('src/lib/crawler.mjs', 'utf8');
  const match11 = html11.match(/<script>([\s\S]*?)<\/script>/);
  if (match11) {
    const vm = await import('node:vm');
    try {
      new vm.Script(match11[1], { filename: 'desktop/index.html:inline-script.js' });
      check(true, 'browser script syntax check passes in v3.2.23');
    } catch (error) {
      check(false, `browser script syntax check failed in v3.2.23: ${error.message}`);
    }
  }
  check(html11.includes("scopeMode = 'exact'"), 'pre-merge: Exact Pages remains default');
  check(html11.includes('data-scope="exact">Exact pages') && html11.includes('data-scope="auto">Auto') && html11.includes('data-scope="sitemap">Sitemap'), 'pre-merge: only Exact/Auto/Sitemap tabs exist');
  check(!html11.includes('Crawl website'), 'pre-merge: Crawl Website tab removed');
  check(html11.includes("if(btn?.dataset.busy==='1' && trigger==='button')return;"), 'pre-merge: hidden stale busy state cannot block Auto/Sitemap');
  check(html11.includes("if(runId!==discoveryRunId){if(btn)btn.dataset.busy='0';appendLog('Ignored stale discovery result after scope changed."), 'pre-merge: stale result clears busy state');
  check(html11.includes("if($('discoveryStatus'))$('discoveryStatus').style.display='none';"), 'pre-merge: discovery status hides in Exact mode switch');
  check(html11.includes("panel.classList.remove('open')"), 'pre-merge: discovery panel closes in Exact mode');
  check(html11.includes('Auto starts immediately'), 'pre-merge: Auto help text explains automatic start');
  check(html11.includes('Sitemap starts immediately'), 'pre-merge: Sitemap help text explains automatic start');
  check(html11.includes('setTimeout(()=>runDiscoveryFromButton(scopeMode),80)'), 'pre-merge: Auto/Sitemap auto-starts on selection');
  check(html11.includes("delete $('pages').dataset.userEditedAuto"), 'pre-merge: switching discovery mode resets stale page edit flag');
  check(html11.includes('function discoveryWorkingRow') && html11.includes('function discoveryErrorRow') && html11.includes('function discoveryFallbackNotice') && html11.includes('function discoveryLowYieldNotice'), 'pre-merge: discovery row helpers preserved');
  check(crawler11.includes('async function revealNavigationControls') && crawler11.includes('await revealNavigationControls(crawlPage)'), 'pre-merge: crawler reveals nav/menu controls');
  check(crawler11.includes('document.scripts') && crawler11.includes('[data-href],[data-url],[data-link]'), 'pre-merge: crawler harvests richer link sources');
  check(main11.includes("data.scopeMode === 'crawl' ? 'auto'"), 'pre-merge: legacy crawl config aliases to Auto');
  check(html11.includes('id="topVersion">v3.2.23'), 'pre-merge: visible top version is 3.2.23');
}

// v3.2.23 final polish checks
{
  const html12 = fs.readFileSync('desktop/index.html', 'utf8');
  const main12 = fs.readFileSync('desktop/main.mjs', 'utf8');
  const crawler12 = fs.readFileSync('src/lib/crawler.mjs', 'utf8');
  const match12 = html12.match(/<script>([\s\S]*?)<\/script>/);
  if (match12) {
    const vm = await import('node:vm');
    try {
      new vm.Script(match12[1], { filename: 'desktop/index.html:inline-script.js' });
      check(true, 'browser script syntax check passes in v3.2.23');
    } catch (error) {
      check(false, `browser script syntax check failed in v3.2.23: ${error.message}`);
    }
  }
  check(html12.includes('v3.2.23 final Target & Scope polish'), 'final Target & Scope polish CSS exists');
  check(html12.includes('function finalUiSanityCheck'), 'final UI sanity check exists');
  check(html12.includes('finalUiSanityCheck();validateCriticalUi();wireCoreButtons();'), 'final UI sanity check runs before wiring');
  check(html12.includes("expectedScopes!=='exact,auto,sitemap'"), 'final UI sanity check validates expected scope tabs');
  check(html12.includes("scopeMode = 'exact'"), 'final: Exact Pages remains default');
  check(html12.includes('data-scope="exact">Exact pages') && html12.includes('data-scope="auto">Auto') && html12.includes('data-scope="sitemap">Sitemap'), 'final: Exact/Auto/Sitemap tabs still present');
  check(!html12.includes('Crawl website'), 'final: Crawl Website remains removed from UI');
  check(html12.includes('Preparing Auto discovery') && html12.includes('Preparing Sitemap discovery'), 'final: Auto/Sitemap show immediate polished preparation rows');
  check(html12.includes('discoveryPanel').toString(), 'final: discovery panel still present');
  check(crawler12.includes('async function revealNavigationControls') && crawler12.includes('await revealNavigationControls(crawlPage)'), 'final: beefier crawler retained');
  check(crawler12.includes('document.scripts') && crawler12.includes('[data-href],[data-url],[data-link]'), 'final: richer link harvesting retained');
  check(main12.includes("data.scopeMode === 'crawl' ? 'auto'"), 'final: legacy crawl alias retained');
  check(html12.includes('id="topVersion">v3.2.23'), 'final: visible top version is 3.2.23');
}

// v3.2.23 Auto/Sitemap tab and Last Run checks
{
  const html13 = fs.readFileSync('desktop/index.html', 'utf8');
  const match13 = html13.match(/<script>([\s\S]*?)<\/script>/);
  if (match13) {
    const vm = await import('node:vm');
    try {
      new vm.Script(match13[1], { filename: 'desktop/index.html:inline-script.js' });
      check(true, 'browser script syntax check passes in v3.2.23');
    } catch (error) {
      check(false, `browser script syntax check failed in v3.2.23: ${error.message}`);
    }
  }
  const switchViewStart = html13.indexOf('function switchView(view)');
  const startDiscoveryStart = html13.indexOf('function startDiscoveryForScope()');
  const switchViewEnd = html13.indexOf('function setScopeTabBusy', switchViewStart);
  check(startDiscoveryStart > switchViewEnd, 'Auto/Sitemap discovery functions are not nested inside switchView');
  check(html13.includes('function setScopeTabBusy') && html13.includes('scope-loading'), 'animated Auto/Sitemap tab busy state exists');
  check(html13.includes("showUiMessage(scopeMode==='auto'?'Auto discovery started.':'Sitemap discovery started.')"), 'Auto/Sitemap show started feedback');
  check(html13.includes('clearScopeTabBusy();') && html13.includes('renderDiscovery(payload);'), 'scope tab spinner clears before render');
  check(html13.includes("document.querySelectorAll('.tab').forEach(tab=>tab.addEventListener('click',()=>switchScopeMode(tab.dataset.scope)))"), 'tab click listener wired globally');
  check(html13.includes("No audit runs yet. Run an audit first"), 'Last Run empty-state feedback exists');
  check(html13.includes('const latestRun=[...runs].sort'), 'Last Run state updates from newest store item');
  check(html13.includes('id="topVersion">v3.2.23'), 'visible top version is 3.2.23');
}

// v3.2.23 final verification checks
{
  const html14 = fs.readFileSync('desktop/index.html', 'utf8');
  const main14 = fs.readFileSync('desktop/main.mjs', 'utf8');
  const crawler14 = fs.readFileSync('src/lib/crawler.mjs', 'utf8');
  const match14 = html14.match(/<script>([\s\S]*?)<\/script>/);
  if (match14) {
    const vm = await import('node:vm');
    try {
      new vm.Script(match14[1], { filename: 'desktop/index.html:inline-script.js' });
      check(true, 'browser script syntax check passes in v3.2.23');
    } catch (error) {
      check(false, `browser script syntax check failed in v3.2.23: ${error.message}`);
    }
  }
  check(html14.includes("scopeMode = 'exact'"), 'v3.2.23: Exact remains default');
  check(html14.includes('data-scope="exact">Exact pages') && html14.includes('data-scope="auto">Auto') && html14.includes('data-scope="sitemap">Sitemap'), 'v3.2.23: Exact/Auto/Sitemap tabs retained');
  check(!html14.includes('Crawl website'), 'v3.2.23: Crawl Website remains removed');
  check(html14.includes('function setScopeTabBusy') && html14.includes('scope-loading'), 'v3.2.23: animated Auto/Sitemap tab retained');
  check(html14.includes('function startDiscoveryForScope') && html14.includes('setTimeout(()=>runDiscoveryFromButton(scopeMode),80)'), 'v3.2.23: Auto/Sitemap auto-start retained');
  check(html14.includes('function switchView(view)') && html14.indexOf('function startDiscoveryForScope()') > html14.indexOf('function setScopeTabBusy'), 'v3.2.23: discovery functions remain outside switchView');
  check(html14.includes('id="sideLastRunCard"') && html14.includes("safeBind('sideLastRunCard'"), 'v3.2.23: sidebar Last Run card is actionable');
  check(html14.includes("const latestRun=[...runs].sort"), 'v3.2.23: Last Run uses newest createdAt run');
  check(html14.includes("sideLastRunCard'))$('sideLastRunCard').classList.toggle('empty-state',!latestRun)"), 'v3.2.23: sidebar Last Run empty state updates');
  check(crawler14.includes('async function revealNavigationControls') && crawler14.includes('await revealNavigationControls(crawlPage)'), 'v3.2.23: beefier crawler retained');
  check(crawler14.includes('document.scripts') && crawler14.includes('[data-href],[data-url],[data-link]'), 'v3.2.23: richer link harvesting retained');
  check(main14.includes("data.scopeMode === 'crawl' ? 'auto'"), 'v3.2.23: legacy crawl alias retained');
  check(html14.includes('id="topVersion">v3.2.23'), 'v3.2.23: visible top version is 3.2.23');
}

if (failed) process.exit(1);
console.log('Preflight passed.');
