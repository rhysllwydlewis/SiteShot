import fs from 'node:fs';

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const build = pkg.build || {};
const win = build.win || {};
const nsis = build.nsis || {};
const scripts = pkg.scripts || {};
const failures = [];

function fail(message) {
  failures.push(message);
}

function hasScript(name, fragment) {
  return typeof scripts[name] === 'string' && (!fragment || scripts[name].includes(fragment));
}

if (!hasScript('install:browsers:bundled', 'PLAYWRIGHT_BROWSERS_PATH=0')) fail('Missing bundled Playwright browser install script.');
if (!hasScript('dist:installer', 'install:browsers:bundled')) fail('dist:installer should install bundled Playwright browsers before packaging.');
if (!hasScript('dist:installer', 'electron-builder --win nsis --x64')) fail('Missing dist:installer script for NSIS Windows installer builds.');
if (!hasScript('installer:win', 'dist:installer')) fail('Missing installer:win convenience script.');
if (!hasScript('check:installer', 'installer-smoke-check')) fail('Missing check:installer script.');
if (!hasScript('verify', 'npm run check:installer')) fail('verify should run the installer smoke check.');

if (!pkg.devDependencies?.['cross-env']) fail('cross-env should be present so bundled browser install works on Windows and CI.');

if (build.artifactName !== 'install.${ext}') fail('Installer artifact name should produce one simple release/install.exe file.');

const files = Array.isArray(build.files) ? build.files : [];
if (!files.includes('docs/**/*')) fail('Packaged app should include docs so the in-app help link still works after installation.');
if (!files.includes('node_modules/playwright-core/.local-browsers/**/*')) fail('Packaged app should include the bundled Playwright browser runtime.');

const targets = Array.isArray(win.target) ? win.target : [];
const hasNsisTarget = targets.some(target => {
  if (typeof target === 'string') return target === 'nsis';
  return target?.target === 'nsis';
});
if (!hasNsisTarget) fail('Windows build should include an NSIS installer target.');

if (win.requestedExecutionLevel !== 'asInvoker') fail('Windows app should request asInvoker execution level by default.');
if (nsis.oneClick !== false) fail('Installer should use assisted install mode rather than opaque one-click install.');
if (nsis.perMachine !== false) fail('Installer should default to per-user install to avoid unnecessary admin prompts.');
if (nsis.allowToChangeInstallationDirectory !== true) fail('Installer should allow users to change the install directory.');
if (nsis.createDesktopShortcut !== 'always') fail('Installer should create a desktop shortcut.');
if (nsis.createStartMenuShortcut !== true) fail('Installer should create a Start Menu shortcut.');
if (nsis.shortcutName !== 'SiteShot Auditor Studio') fail('Installer shortcut name should match the product name.');
if (nsis.runAfterFinish !== true) fail('Installer should offer to launch the app after install.');
if (nsis.deleteAppDataOnUninstall !== false) fail('Uninstall should not delete user audit data by default.');

for (const requiredFile of ['docs/INSTALLER.md', 'BUILD WINDOWS INSTALLER.bat', '.github/workflows/build-windows-exe.yml', '.github/workflows/release-windows.yml']) {
  if (!fs.existsSync(requiredFile)) fail(`Missing required installer-related file: ${requiredFile}`);
}

const buildWorkflow = fs.readFileSync('.github/workflows/build-windows-exe.yml', 'utf8');
if (!buildWorkflow.includes('npm run dist:installer')) fail('Build Windows workflow should build the installer.');
if (!buildWorkflow.includes('SiteShot-Auditor-Studio-Ultra-Installer')) fail('Build workflow should upload a clearly named installer artifact.');
if (!buildWorkflow.includes('release/install.exe')) fail('Build workflow should upload the single install.exe file.');

const releaseWorkflow = fs.readFileSync('.github/workflows/release-windows.yml', 'utf8');
if (!releaseWorkflow.includes('npm run dist:installer')) fail('Release workflow should build the installer.');
if (!releaseWorkflow.includes('release/install.exe')) fail('Release workflow should publish install.exe.');

const installerBatch = fs.readFileSync('BUILD WINDOWS INSTALLER.bat', 'utf8');
if (!installerBatch.includes('npm.cmd run verify')) fail('Installer batch file should run full verification before building.');
if (!installerBatch.includes('npm.cmd run dist:installer')) fail('Installer batch file should build the setup installer.');
if (!installerBatch.includes('release\\install.exe')) fail('Installer batch file should look for release\\install.exe.');

if (failures.length) {
  console.error('\nInstaller smoke check failed:\n');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Installer smoke checks passed.');
