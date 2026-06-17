# Roadmap

This roadmap is deliberately practical and release-focused.

## Phase 1: Stable GitHub product build

- Confirm CI passes on every PR.
- Confirm the Windows build workflow creates a usable artifact.
- Add `package-lock.json` from a clean install.
- Switch Actions from `npm install` to `npm ci` after the lockfile lands.
- Keep README, Windows guide and release notes aligned.

## Phase 2: Windows product polish

- Add a proper application icon.
- Decide whether to continue with unpacked app output or add an installer.
- Add signed release guidance if the app will be distributed publicly.
- Create versioned GitHub Releases with clear notes.

## Phase 3: Audit quality

- Improve route discovery quality for app-driven and crawler-resistant sites.
- Add clearer issue prioritisation in reports.
- Improve evidence grouping across desktop, tablet and mobile captures.
- Strengthen report summaries for non-technical users.

## Phase 4: Workflow and usability

- Add saved presets for common audit types.
- Add clearer first-run/onboarding guidance.
- Improve error recovery where a site blocks crawling or loads behind auth.
- Add safer export naming for multiple client/project runs.

## Phase 5: Future product options

- Consider a hosted companion dashboard.
- Consider scheduled audits.
- Consider branded client reports.
- Consider richer comparison reports between before/after audit runs.
