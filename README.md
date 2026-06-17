# SiteShot Auditor Studio Ultra v3

A professional website audit suite for real browser screenshots, responsive QA, UX, accessibility, SEO, performance, functionality, content/trust, privacy and safe passive security checks.

This is designed to move beyond a basic screenshot tool and become a real audit product.

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

## Run on Windows

Extract the zip, then double-click:

```text
START SiteShot Auditor Studio.bat
```

## Build Windows installer / EXE

Double-click:

```text
BUILD WINDOWS EXE.bat
```

## Developer commands

```bash
npm install
npm run install:browsers
npm run doctor
npm run audit:eventflow
npm run desktop
```
