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
  'exclude',
  'flagText',
  'budgets',
  'security'
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
  if (!content.includes('npm run preflight')) fail(`${workflow} should run npm run preflight.`);
}

const prTemplate = read('.github/pull_request_template.md');
for (const requiredText of ['Pre-merge checklist', 'Testing notes', 'Follow-up work']) {
  if (!prTemplate.includes(requiredText)) fail(`Pull request template is missing: ${requiredText}`);
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
