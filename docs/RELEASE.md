# Release process

This project currently builds an unpacked Windows app using Electron Builder.

## Recommended release flow

1. Merge all code changes into `main`.
2. Run the CI workflow and confirm `npm run check` and `npm run preflight` pass.
3. Run the Build Windows EXE workflow manually to confirm the Windows artifact builds.
4. Run the Release Windows Build workflow with a tag such as `v3.2.23`.
5. Download the release zip and smoke-test it on Windows.
6. Publish/share the release once the app opens and an audit can be started.

## Current packaging approach

The current packaging route intentionally builds an unpacked Windows app folder rather than an NSIS installer. This avoids installer-stage issues and keeps the first public release path simple.

Expected local output:

```text
release/win-unpacked/SiteShot Auditor Studio.exe
```

Expected installed local copy after running the Windows build batch file:

```text
%LOCALAPPDATA%\Programs\SiteShot Auditor Studio\SiteShot Auditor Studio.exe
```

## Lockfile note

The repository should gain a committed `package-lock.json` as soon as dependencies are installed from a clean developer machine. Once that file is committed, GitHub Actions should be switched from `npm install` to `npm ci` for fully repeatable builds.

Suggested local command:

```bash
npm install
```

Then commit the generated `package-lock.json` in a small follow-up PR.

## Future installer route

Before moving from unpacked app output to a proper installer, add:

- a real application icon
- a signed installer strategy if distributing externally
- a clean upgrade/update route
- release notes per version
