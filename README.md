# SiteShot Auditor Studio Ultra v3

A professional website audit suite for real browser screenshots, responsive QA, UX, accessibility, SEO, performance, functionality, content/trust, privacy and safe passive security checks.

This is designed to move beyond a basic screenshot tool and become a real audit product.

## Current version

SiteShot Auditor Studio Ultra is currently on **v3.2.23**.

This version confirms the simplified Target & Scope flow:

- Exact pages is the default.
- Auto starts discovery automatically when selected.
- Sitemap starts discovery automatically when selected.
- Auto/Sitemap show an animated working state while discovery is running.
- Last Run uses the newest saved run and is actionable from both the topbar and sidebar.

## What it produces

Every audit produces a complete evidence pack:

```text
report.html              Main professional report
executive-summary.html   Short client/management report
technical-report.html    Deeper developer report
fix-roadmap.html         Prioritised fix plan
gallery.html             Screenshot gallery
issues.json              Full issue register
issues.csv               CSV issue register
tickets.md               Developer ticket backlog
summary.json             Scores and counts
manifest.json            Raw audit manifest
screenshots/             Evidence screenshots
```

## Modules

- Visual / Responsive UX
- Functionality / Broken Website Checks
- SEO
- Accessibility
- Performance
- Safe Passive Security
- Privacy / Compliance Signals
- Content / Trust / Placeholder Detection
- Technical Quality

## Safety

Security checks are passive and non-invasive. The tool does not exploit, brute force, inject payloads, bypass authentication, fuzz forms, or perform destructive testing.

It checks configuration, headers, resources, public page source, common accidental exposure paths by status code only, and other safe indicators.

For the full security scope, read `SECURITY.md` and `docs/SAFETY.md`.

## Recommended Windows install

Normal users should download the Windows setup installer from the latest GitHub Release:

```text
SiteShot-Auditor-Studio-Ultra-Setup-<version>-x64.exe
```

Run the installer, keep the shortcut options selected, then launch **SiteShot Auditor Studio** from the desktop shortcut or the Windows Start Menu.

For installer behaviour and release notes, read:

```text
docs/INSTALLER.md
```

## Run on Windows without installer

Extract the zip, then double-click:

```text
START SiteShot Auditor Studio.bat
```

For the full Windows guide, read:

```text
README FIRST - WINDOWS.txt
```

## Build Windows installer locally

```bash
npm install
npm run install:browsers
npm run verify
npm run dist:installer
```

Expected output:

```text
release/SiteShot-Auditor-Studio-Ultra-Setup-<version>-x64.exe
```

## Build unpacked Windows app locally

Double-click:

```text
BUILD WINDOWS EXE.bat
```

Or run:

```bash
npm run dist:win
```

This builds an unpacked Windows app at:

```text
release/win-unpacked/SiteShot Auditor Studio.exe
```

## Developer commands

```bash
npm install
npm run install:browsers
npm run check
npm run check:repo
npm run check:config
npm run check:installer
npm run preflight
npm run verify
npm run doctor
npm run audit:eventflow
npm run audit:eventflow:public
npm run audit:eventflow:full
npm run desktop
```

## GitHub Actions

The repository includes workflows for:

- CI checks on push and pull request.
- Manual Windows installer builds.
- Manual release packaging with the setup installer as the recommended download.
- Manual EventFlow audit runs.

The workflow action baseline is documented in `docs/WORKFLOW-MAINTENANCE.md`.

## Example configs

- `examples/eventflow-public.ultra-audit.json` audits public EventFlow pages only.
- `examples/eventflow-full.ultra-audit.json` includes public pages plus auth/reset/verify routes.
- `examples/eventflow.ultra-audit.json` is the default public EventFlow audit used by `npm run audit:eventflow`.

## Project docs

- `README FIRST - WINDOWS.txt` - Windows user guide.
- `docs/INSTALLER.md` - Windows installer and release packaging guide.
- `docs/TROUBLESHOOTING.md` - common local build, browser and audit issues.
- `docs/RELEASE.md` - release process.
- `docs/ROADMAP.md` - practical product roadmap.
- `docs/WORKFLOW-MAINTENANCE.md` - GitHub Actions and Dependabot maintenance guidance.
- `CHANGELOG.md` - version history.
- `CONTRIBUTING.md` - contribution and PR expectations.
- `SECURITY.md` - security policy and safe testing scope.
