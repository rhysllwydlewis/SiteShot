import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const requiredFiles = [
  'package.json',
  'README.md',
  'README FIRST - WINDOWS.txt',
  'docs/RELEASE.md',
  'docs/SAFETY.md',
  '.github/workflows/ci.yml',
  '.github/workflows/build-windows-exe.yml',
  '.github/workflows/release-windows.yml',
  'examples/eventflow.ultra-audit.json',
  'examples/eventflow-public.ultra-audit.json',
  'examples/eventflow-full.ultra-audit.json'
];

const requiredScripts = [
  'check',
  'preflight',
  'verify',
  'check:repo',
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
  'budgets',
  'security'
];

const failures = [];
const notes = [];

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

function exists(file) {
  return fs.existsSync(path.join(root, file));
}

function fail(message) {
  failures.push(message);
}

function note(message) {
  notes.push(message);
}

for (const file of requiredFiles) {
  if (!exists(file)) fail(`Missing required file: ${file}`);
}

const pkg = JSON.parse(read('package.json'));
const version = pkg.version;

if (!version) fail('package.json is missing a version.');
if (pkg.name !== 'siteshot-auditor-studio-ultra') fail('package.json name does not match the product package name.');

for (const script of requiredScripts) {
  if (!pkg.scripts?.[script]) fail(`Missing npm script: ${script}`);
}

for (const docFile of ['README.md', 'README FIRST - WINDOWS.txt']) {
  const content = read(docFile);
  if (!content.includes(version)) fail(`${docFile} does not mention version ${version}.`);
}

const windowsGuide = read('README FIRST - WINDOWS.txt');
for (const requiredText of ['Exact pages is the default', 'Auto starts discovery automatically', 'Sitemap starts discovery automatically']) {
  if (!windowsGuide.includes(requiredText)) fail(`Windows guide is missing current flow wording: ${requiredText}`);
}

const releaseDoc = read('docs/RELEASE.md');
if (!releaseDoc.includes('package-lock.json')) fail('docs/RELEASE.md should document the package-lock follow-up.');

for (const example of [
  'examples/eventflow.ultra-audit.json',
  'examples/eventflow-public.ultra-audit.json',
  'examples/eventflow-full.ultra-audit.json'
]) {
  const json = JSON.parse(read(example));
  for (const key of requiredExampleKeys) {
    if (!(key in json)) fail(`${example} is missing required key: ${key}`);
  }
  if (!Array.isArray(json.pages) || json.pages.length === 0) fail(`${example} must include at least one page.`);
  if (!Array.isArray(json.devices) || json.devices.length === 0) fail(`${example} must include at least one device.`);
  if (!Array.isArray(json.modules) || json.modules.length === 0) fail(`${example} must include at least one module.`);
}

const publicExample = JSON.parse(read('examples/eventflow-public.ultra-audit.json'));
const publicOnlyExample = JSON.parse(read('examples/eventflow.ultra-audit.json'));
const fullExample = JSON.parse(read('examples/eventflow-full.ultra-audit.json'));
const privateRoutes = ['/auth', '/forgot-password', '/reset-password', '/verify'];

for (const route of privateRoutes) {
  if (publicExample.pages.includes(route)) fail(`Public EventFlow example should not include ${route}.`);
  if (publicOnlyExample.pages.includes(route)) fail(`Default EventFlow example should not include ${route}.`);
  if (!publicExample.exclude.includes(route)) fail(`Public EventFlow example should exclude ${route}.`);
  if (!publicOnlyExample.exclude.includes(route)) fail(`Default EventFlow example should exclude ${route}.`);
}

for (const route of privateRoutes) {
  if (!fullExample.pages.includes(route)) fail(`Full EventFlow example should include ${route}.`);
}

const ci = read('.github/workflows/ci.yml');
if (!ci.includes('npm run verify')) fail('CI should run npm run verify.');

for (const workflow of ['.github/workflows/build-windows-exe.yml', '.github/workflows/release-windows.yml']) {
  const content = read(workflow);
  if (!content.includes('npm run check')) fail(`${workflow} should run npm run check.`);
  if (!content.includes('npm run preflight')) fail(`${workflow} should run npm run preflight.`);
}

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
