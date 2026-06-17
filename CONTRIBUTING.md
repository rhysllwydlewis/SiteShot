# Contributing

This repo is currently maintained as a focused product build for SiteShot Auditor Studio Ultra.

## Preferred PR shape

Larger PRs are acceptable when the changes are part of one clear theme, for example release readiness, report quality or UI flow. Avoid mixing unrelated app logic, design changes and build-system changes unless the PR explains why they belong together.

## Before opening a PR

Run:

```bash
npm install
npm run verify
```

`npm run verify` runs syntax checks, repo consistency checks and the app preflight.

## PR checklist

Use the pull request template and include:

- what changed
- why it changed
- what was tested
- any known limitations
- any follow-up work

## Documentation expectations

If a change affects how the app is used, update the relevant docs:

- `README.md`
- `README FIRST - WINDOWS.txt`
- `docs/RELEASE.md`
- `docs/SAFETY.md`

## Release changes

If a PR affects packaging or release behaviour, confirm whether the Windows build workflow needs to be run before merge.
