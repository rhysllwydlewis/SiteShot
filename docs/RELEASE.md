# Release process

This project builds a normal Windows installer for SiteShot Auditor Studio Ultra.

## Recommended release flow

1. Merge all code changes into `main`.
2. Run the CI workflow and confirm `npm run verify` passes.
3. Run the Build Windows EXE workflow manually to confirm the Windows installer artifact builds.
4. Download `install.exe` and test it locally on Windows.
5. Run the Release Windows Build workflow with a tag such as `v3.2.23`.
6. Download the release `install.exe` and test it on Windows.
7. Share the release once the installer runs, the shortcuts are created, the app opens, and an audit can be started.

## Pre-release test

Before treating a build as releasable, confirm:

- `release/install.exe` is created
- running `install.exe` installs SiteShot Auditor Studio
- the desktop shortcut is created
- the Start Menu shortcut is created
- the app opens correctly from a shortcut
- Exact Pages is the default scope
- Auto starts discovery when selected
- Sitemap starts discovery when selected
- Last Run opens Audit Runs from the topbar and sidebar
- an audit can be started against a controlled page list
- the output folder contains report HTML and issue files

## Current packaging approach

The current packaging route intentionally builds an NSIS Windows installer as the only user-facing download. Normal users should receive one file:

```text
install.exe
```

Expected local installer output:

```text
release/install.exe
```

Expected installed local copy after running the installer:

```text
%LOCALAPPDATA%\Programs\SiteShot Auditor Studio\SiteShot Auditor Studio.exe
```

## Lockfile note

The repository should gain a committed `package-lock.json` as soon as dependencies are installed from a clean developer machine. Once that file is committed, GitHub Actions should be switched from `npm install` to `npm ci` for fully repeatable builds.

Suggested local command:

```bash
npm install
```

Then commit the generated `package-lock.json` in a follow-up PR.

## Future installer route

Before distributing externally at scale, add:

- a real application icon
- a signed installer strategy
- a clean upgrade/update route
- release notes per version
