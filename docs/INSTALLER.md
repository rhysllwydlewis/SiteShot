# Windows installer

SiteShot Auditor Studio Ultra should be distributed to normal users as a Windows setup installer, not as a loose developer folder.

## Recommended user flow

1. Download the latest `SiteShot-Auditor-Studio-Ultra-Setup-*.exe` file from the GitHub Release.
2. Run the installer.
3. Keep the desktop shortcut option selected.
4. Finish the installer.
5. Launch **SiteShot Auditor Studio** from the desktop shortcut or the Windows Start Menu.

## Installer behaviour

The installer is configured to:

- use a clear setup file name with the product version
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

Expected installer output:

```text
release/SiteShot-Auditor-Studio-Ultra-Setup-<version>-x64.exe
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

The workflow now uploads two artifacts:

- `SiteShot-Auditor-Studio-Ultra-Installer` for the setup EXE
- `SiteShot-Auditor-Studio-Ultra-Windows-Unpacked` for fallback/manual use

Use:

```text
Actions → Release Windows Build → Run workflow
```

to publish the installer as a GitHub Release asset.

## Branding follow-up

The installer is now configured as a proper guided Windows setup experience. The next branding step is to add final production artwork assets such as:

- Windows `.ico` application icon
- installer header image
- installer sidebar/wizard image
- optional signed publisher certificate

Those should be added once the final SiteShot brand artwork is approved, because Windows installer icons need production-ready binary artwork rather than placeholder images.
