# Architecture

## Main areas

- `desktop/` Electron desktop application
- `bin/siteshot.mjs` CLI entry point
- `src/audit.mjs` audit orchestration
- `src/modules/` audit modules
- `src/reporting/` professional report generation
- `templates/` report and rules templates
- `examples/` starter audit configs

## Audit flow

1. Load config
2. Discover pages
3. Launch Playwright Chromium
4. Capture each page/device
5. Run selected modules
6. Normalise issues into a shared issue schema
7. Score results
8. Generate reports and exports
