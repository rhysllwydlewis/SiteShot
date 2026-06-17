# Workflow maintenance

This repo uses GitHub Actions for CI, Windows builds, release packaging and manual audit runs.

## Why action versions matter

GitHub periodically changes the Node.js runtime used by Actions. Older action major versions can continue to work but may raise warnings such as Node.js 20 deprecation notices.

To keep workflows clean, the repo should avoid stale action references where a maintained major version is already available.

## Current action baseline

The current workflow baseline is:

```text
actions/checkout@v6
actions/setup-node@v6
actions/upload-artifact@v7
softprops/action-gh-release@v3
```

## Before merging workflow changes

Confirm:

- CI still runs `npm run verify`.
- Windows build still checks syntax, repo consistency and preflight before packaging.
- Release workflow still creates `SiteShot-Auditor-Studio-Ultra-Windows.zip`.
- Manual audit workflow still uploads the audit artifact.
- Workflow permissions are no wider than needed.

## Dependabot approach

Dependabot is intentionally configured with a low open PR limit to avoid noisy PR bursts. Major Electron and electron-builder updates should be treated as deliberate upgrade projects rather than automatic maintenance.

Safe routine maintenance:

- GitHub Actions patch/minor updates
- npm patch/minor updates
- documentation-only workflow clarification

Higher-risk maintenance:

- Electron major version jumps
- electron-builder major version jumps
- packaging target changes
- installer/signing changes

Those higher-risk items should be bundled into a dedicated build-hardening PR with a Windows artifact check.
