import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

const requiredFiles = [
  'package.json',
  'README.md',
  'README FIRST - WINDOWS.txt',
  'CHANGELOG.md',
  'CONTRIBUTING.md',
  'SECURITY.md',
  'docs/INSTALLER.md',
  'docs/RELEASE.md',
  'docs/ROADMAP.md',
  'docs/SAFETY.md',
  'docs/TROUBLESHOOTING.md',
  '.github/dependabot.yml',
  '.github/pull_request_template.md',
  '.github/ISSUE_TEMPLATE/bug_report.md',
  '.github/ISSUE_TEMPLATE/feature_request.md',
  '.github/workflows/ci.yml',
  '.github/workflows/build-windows-exe.yml',
  '.github/workflows/release-windows.yml',
  '.github/workflows/run-ultra-audit.yml',
  'examples/eventflow.ultra-audit.json',
  'examples/eventflow-public.ultra-audit.json',
  'examples/eventflow-full.ultra-audit.json',
  'scripts/config-smoke-check.mjs',
  'scripts/installer-smoke-check.mjs',
  'BUILD WINDOWS INSTALLER.bat'
];

const requiredScripts = [
  'check',
  'preflight',
  'verify',
  'check:repo',
  'check:config',
  'check:installer',
  'install:browsers:bundled',
  'dist:installer',
  'installer:win',
  'audit:eventflow',
  'audit:eventflow:public',
  'audit:eventflow:full'
];

const requiredExampleKeys = [
  'name',
  'url',
  'out',
  'devices',
  'pages',
  'modules',
  'reportStyle',
  'capture',
  'exclude',
  'flagText',
  'budgets',
  'security'
];

const workflowFiles = [
  '.github/workflows/ci.yml',
  '.github/workflows/build-windows-exe.yml',
  '.github/workflows/release-windows.yml',
  '.github/workflows/run-ultra-audit.yml'
];

const blockedActionRefs = [
  'actions/checkout@v4',
  'actions/setup-node@v4',
  'actions/upload-artifact@v4',
  'softprops/action-gh-release@v2'
];

const failures = [];
const notes = [];

function filePath(file) {
  return path.join(root, file);
}

function read(file) {
  return fs.readFileSync(filePath(file), 'utf8');
}

function exists(file) {
  return fs.existsSync(filePath(file));
}

function fail(message) {
  failures.push(message);
}

function note(message) {
  notes.push(message);
}

function readJson(file) {
  try {
    return JSON.parse(read(file));
  } catch (error) {
    fail(`${file} is not valid JSON: ${error.message}`);
    return null;
  }
}

for (const file of requiredFiles) {
  if (!exists(file)) fail(`Missing required file: ${file}`);
}

if (failures.length) {
  console.error('\nPre-merge check failed before file content validation:\n');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

const pkg = readJson('package.json');
const version = pkg?.version;

if (!version) fail('package.json is missing a version.');
if (pkg?.name !== 'siteshot-auditor-studio-ultra') fail('package.json name does not match the product package name.');

for (const script of requiredScripts) {
  if (!pkg?.scripts?.[script]) fail(`Missing npm script: ${script}`);
}

if (!pkg?.scripts?.verify?.includes('npm run check:config')) fail('verify should run config smoke checks.');
if (!pkg?.scripts?.verify?.includes('npm run check:installer')) fail('verify should run installer smoke checks.');
if (!pkg?.scripts?.['dist:installer']?.includes('install:browsers:bundled')) fail('dist:installer should bundle Playwright browsers before packaging.');
if (!pkg?.scripts?.['install:browsers:bundled']?.includes('PLAYWRIGHT_BROWSERS_PATH=0')) fail('install:browsers:bundled should use PLAYWRIGHT_BROWSERS_PATH=0.');
if (!pkg?.devDependencies?.['cross-env']) fail('cross-env should be present for cross-platform bundled browser installation.');
if (!pkg?.build?.files?.includes('node_modules/playwright-core/.local-browsers/**/*')) fail('Packaged app should include bundled Playwright browsers.');

for (const docFile of ['README.md', 'README FIRST - WINDOWS.txt', 'CHANGELOG.md', 'SECURITY.md']) {
  const content = read(docFile);
  if (version && !content.includes(version)) fail(`${docFile} does not mention version ${version}.`);
}

const windowsGuide = read('README FIRST - WINDOWS.txt');
for (const requiredText of ['Exact pages is the default', 'Auto starts discovery automatically', 'Sitemap starts discovery automatically']) {
  if (!windowsGuide.includes(requiredText)) fail(`Windows guide is missing current flow wording: ${requiredText}`);
}

const readme = read('README.md');
for (const requiredText of ['npm run verify', 'docs/TROUBLESHOOTING.md', 'SECURITY.md', 'CHANGELOG.md']) {
  if (!readme.includes(requiredText)) fail(`README.md is missing support/verification reference: ${requiredText}`);
}

const releaseDoc = read('docs/RELEASE.md');
if (!releaseDoc.includes('package-lock.json')) fail('docs/RELEASE.md should document the package-lock follow-up.');
if (!releaseDoc.includes('npm run verify')) fail('docs/RELEASE.md should refer to npm run verify.');

const installerDoc = read('docs/INSTALLER.md');
for (const requiredText of ['SiteShot-Auditor-Studio-Ultra-Setup', 'desktop shortcut', 'Start Menu', 'npm run dist:installer']) {
  if (!installerDoc.includes(requiredText)) fail(`docs/INSTALLER.md is missing installer guidance: ${requiredText}`);
}

for (const example of [
  'examples/eventflow.ultra-audit.json',
  'examples/eventflow-public.ultra-audit.json',
  'examples/eventflow-full.ultra-audit.json'
]) {
  const json = readJson(example);
  if (!json) continue;

  for (const key of requiredExampleKeys) {
    if (!(key in json)) fail(`${example} is missing required key: ${key}`);
  }

  for (const key of ['pages', 'devices', 'modules', 'exclude', 'flagText']) {
    if (!Array.isArray(json[key])) fail(`${example}.${key} must be an array.`);
  }

  if (Array.isArray(json.pages) && json.pages.length === 0) fail(`${example} must include at least one page.`);
  if (Array.isArray(json.devices) && json.devices.length === 0) fail(`${example} must include at least one device.`);
  if (Array.isArray(json.modules) && json.modules.length === 0) fail(`${example} must include at least one module.`);
}

const publicExample = readJson('examples/eventflow-public.ultra-audit.json');
const publicOnlyExample = readJson('examples/eventflow.ultra-audit.json');
const fullExample = readJson('examples/eventflow-full.ultra-audit.json');
const privateRoutes = ['/auth', '/forgot-password', '/reset-password', '/verify'];

if (publicExample && publicOnlyExample && fullExample) {
  for (const route of privateRoutes) {
    if (publicExample.pages.includes(route)) fail(`Public EventFlow example should not include ${route}.`);
    if (publicOnlyExample.pages.includes(route)) fail(`Default EventFlow example should not include ${route}.`);
    if (!publicExample.exclude.includes(route)) fail(`Public EventFlow example should exclude ${route}.`);
    if (!publicOnlyExample.exclude.includes(route)) fail(`Default EventFlow example should exclude ${route}.`);
  }

  for (const route of privateRoutes) {
    if (!fullExample.pages.includes(route)) fail(`Full EventFlow example should include ${route}.`);
  }
}

const ci = read('.github/workflows/ci.yml');
if (!ci.includes('workflow_dispatch')) fail('CI should be manually runnable with workflow_dispatch.');
if (!ci.includes('npm run verify')) fail('CI should run npm run verify.');

for (const workflow of ['.github/workflows/build-windows-exe.yml', '.github/workflows/release-windows.yml']) {
  const content = read(workflow);
  if (!content.includes('npm run check')) fail(`${workflow} should run npm run check.`);
  if (!content.includes('npm run check:repo')) fail(`${workflow} should run npm run check:repo.`);
  if (!content.includes('npm run check:installer')) fail(`${workflow} should run npm run check:installer.`);
  if (!content.includes('npm run preflight')) fail(`${workflow} should run npm run preflight.`);
  if (!content.includes('npm run dist:installer')) fail(`${workflow} should build the Windows installer.`);
}

for (const workflow of workflowFiles) {
  const content = read(workflow);
  for (const blockedRef of blockedActionRefs) {
    if (content.includes(blockedRef)) fail(`${workflow} still uses deprecated or warning-prone action reference: ${blockedRef}`);
  }
}

const configSmokeCheck = read('scripts/config-smoke-check.mjs');
if (!configSmokeCheck.includes('CLI URL should win')) fail('Config smoke check should verify workflow/CLI URL handling.');
if (!configSmokeCheck.includes('Invalid maxPages should fall back')) fail('Config smoke check should cover numeric default handling.');

const installerSmokeCheck = read('scripts/installer-smoke-check.mjs');
if (!installerSmokeCheck.includes('createDesktopShortcut')) fail('Installer smoke check should verify desktop shortcut behaviour.');
if (!installerSmokeCheck.includes('createStartMenuShortcut')) fail('Installer smoke check should verify Start Menu shortcut behaviour.');
if (!installerSmokeCheck.includes('dist:installer')) fail('Installer smoke check should verify installer build scripts.');
if (!installerSmokeCheck.includes('PLAYWRIGHT_BROWSERS_PATH=0')) fail('Installer smoke check should verify bundled Playwright browser install.');
if (!installerSmokeCheck.includes('node_modules/playwright-core/.local-browsers/**/*')) fail('Installer smoke check should verify bundled browser files are packaged.');

const installerBatch = read('BUILD WINDOWS INSTALLER.bat');
if (!installerBatch.includes('npm.cmd run verify')) fail('BUILD WINDOWS INSTALLER.bat should run full verification.');
if (!installerBatch.includes('npm.cmd run dist:installer')) fail('BUILD WINDOWS INSTALLER.bat should build the setup installer.');

const prTemplate = read('.github/pull_request_template.md');
for (const requiredText of ['Pre-merge checklist', 'Testing notes', 'Follow-up work']) {
  if (!prTemplate.includes(requiredText)) fail(`Pull request template is missing: ${requiredText}`);
}

const dependabot = read('.github/dependabot.yml');
if (!dependabot.includes('open-pull-requests-limit: 2')) fail('Dependabot should use a low PR limit to avoid noisy update bursts.');
if (!dependabot.includes('version-update:semver-major')) fail('Dependabot should explicitly control major update noise.');

if (!exists('package-lock.json')) {
  note('package-lock.json is not present yet. Keep using npm install until a clean lockfile is generated and committed.');
}

if (failures.length) {
  console.error('\nPre-merge check failed:\n');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Pre-merge repo checks passed.');
if (notes.length) {
  console.log('\nNotes:');
  for (const item of notes) console.log(`- ${item}`);
}
