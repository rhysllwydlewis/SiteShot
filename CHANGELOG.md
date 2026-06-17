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

### Repo and release readiness

- Added CI checks for syntax, repo consistency and preflight.
- Added manual Windows build and release workflows.
- Added public and full EventFlow audit examples.
- Added release process documentation.
- Added repository quality templates and policies.

## Notes

The next release-readiness milestone is to add a clean `package-lock.json` and then move GitHub Actions from `npm install` to `npm ci`.
