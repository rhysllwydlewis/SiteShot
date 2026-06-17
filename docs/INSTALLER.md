# Windows installer

SiteShot Auditor Studio Ultra should be distributed to normal users as one Windows setup installer file, not as a loose developer folder.

## Recommended user flow

1. Download `install.exe` from the latest GitHub Release.
2. Run `install.exe`.
3. Keep the desktop shortcut option selected.
4. Finish the installer.
5. Launch **SiteShot Auditor Studio** from the desktop shortcut or the Windows Start Menu.

## Installer behaviour

The installer is configured to:

- produce one simple download file named `install.exe`
- install the packaged app files from that installer
- install per user by default, avoiding unnecessary administrator prompts
- allow elevation when Windows requires it
- allow the user to change the installation directory
- create a desktop shortcut
- create a Start Menu shortcut
- launch SiteShot after installation
- preserve audit data when uninstalling by default

## Build locally

```bash
npm install
npm run install:browsers
npm run verify
npm run dist:installer
```

Or double-click:

```text
BUILD WINDOWS INSTALLER.bat
```

Expected installer output:

```text
release/install.exe
```

Expected unpacked output:

```text
release/win-unpacked/SiteShot Auditor Studio.exe
```

## GitHub Actions

Use:

```text
Actions → Build Windows EXE → Run workflow
```

The workflow uploads two artifacts:

- `SiteShot-Auditor-Studio-Ultra-Installer` containing `install.exe`
- `SiteShot-Auditor-Studio-Ultra-Windows-Unpacked` for fallback/manual use

Use:

```text
Actions → Release Windows Build → Run workflow
```

to publish `install.exe` as a GitHub Release asset.

## Branding follow-up

The installer is now configured as a proper guided Windows setup experience. The next branding step is to add final production artwork assets such as:

- Windows `.ico` application icon
- installer header image
- installer sidebar/wizard image
- optional signed publisher certificate

Those should be added once the final SiteShot brand artwork is approved, because Windows installer icons need production-ready binary artwork rather than placeholder images.
