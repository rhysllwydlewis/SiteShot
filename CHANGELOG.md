# Changelog

All notable changes to SiteShot Auditor Studio Ultra should be recorded here.

## v3.2.23

### Confirmed

- Exact Pages remains the default Target & Scope option.
- Auto starts discovery automatically when selected.
- Sitemap starts discovery automatically when selected.
- Auto and Sitemap tabs show immediate working feedback.
- Discovery functions remain outside `switchView` so tab clicks stay wired correctly.
- Switching scope modes ignores stale discovery results.
- Last Run uses the newest saved run by `createdAt`.
- Last Run is actionable from both the topbar and sidebar.
- Last Run empty-state styling applies consistently.

### Auto and Sitemap discovery

- Auto discovery uses sitemap data, homepage crawling, navigation/menu expansion and common public route probing.
- Sitemap discovery reads standard sitemap locations, robots.txt sitemap declarations and nested sitemap indexes.
- Discovery returns quality, confidence, source count, rejection reason and recommendation metadata for future UI/report use.

### Installer and release packaging

- Added a proper NSIS Windows installer target.
- Added `npm run dist:installer` and `npm run installer:win`.
- Added installer smoke checks into `npm run verify`.
- Windows build workflow now uploads a setup installer artifact and an unpacked fallback artifact.
- Release workflow now publishes the setup EXE as the recommended release download.
- Added installer guidance in `docs/INSTALLER.md`.

### Repo and release readiness

- Added CI checks for syntax, repo consistency and preflight.
- Added manual Windows build and release workflows.
- Added public and full EventFlow audit examples.
- Added release process documentation.
- Added repository quality templates and policies.

### Workflow maintenance

- Updated GitHub Actions references to the current maintained action majors used by this repo.
- Added explicit workflow permissions where appropriate.
- Added repo checks to the Windows build and release workflows.
- Added workflow maintenance documentation.
- Reduced Dependabot noise by lowering open PR limits and treating major Electron/electron-builder upgrades as deliberate build-hardening work.

## Notes

The next release-readiness milestone is to add a clean `package-lock.json` and then move GitHub Actions from `npm install` to `npm ci`.
