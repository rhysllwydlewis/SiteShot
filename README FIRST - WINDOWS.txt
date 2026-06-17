SITE SHOT AUDITOR STUDIO ULTRA v3.2.23

This is the current Windows guide for SiteShot Auditor Studio Ultra.

WHAT THIS VERSION DOES

SiteShot Auditor Studio Ultra audits public websites using a real browser. It captures evidence screenshots and produces professional reports covering visual QA, responsive layout, UX, accessibility, SEO, performance, technical checks, content/trust signals, privacy checks and safe passive security signals.

CURRENT TARGET AND SCOPE FLOW

1. Exact pages is the default.
   Use this when you already know which URLs you want to audit.

2. Auto starts discovery automatically.
   Select Auto and the app will immediately start finding public pages from the target website. The selected Auto tab shows an animated spinner while discovery is running.

3. Sitemap starts discovery automatically.
   Select Sitemap and the app will immediately look for sitemap URLs. The selected Sitemap tab shows an animated spinner while discovery is running.

4. Crawl Website is no longer shown in the UI.
   Old saved configs that reference Crawl are treated as Auto for compatibility.

5. Switching modes ignores stale discovery results.
   If you switch from Auto to Sitemap, or back to Exact pages, old discovery results are ignored so they do not overwrite the current mode.

LAST RUN BEHAVIOUR

- Last Run shows Never until an audit has completed.
- The topbar Last Run control opens Audit Runs.
- The sidebar Last Run card also opens Audit Runs.
- Last Run uses the newest saved run by createdAt, rather than assuming the first stored item is newest.

HOW NORMAL USERS SHOULD INSTALL ON WINDOWS

1. Download install.exe from the latest GitHub Release.
2. Double-click install.exe.
3. Keep the desktop shortcut option selected.
4. Finish the installer.
5. Launch SiteShot Auditor Studio from the desktop shortcut or the Windows Start Menu.

HOW TO BUILD THE WINDOWS INSTALLER

BUILD WINDOWS INSTALLER.bat will:

1. Check that Node.js is installed.
2. Run npm install.
3. Install Playwright Chromium.
4. Run npm run verify.
5. Build the Windows installer.
6. Create the one installer file at:

   release\install.exe

EXPECTED OUTPUT

The user-facing Windows installer should be created at:

release\install.exe

The installed app should then be available through the desktop shortcut, the Windows Start Menu, and at:

%LOCALAPPDATA%\Programs\SiteShot Auditor Studio\SiteShot Auditor Studio.exe

GITHUB BUILD NOTES

The repository includes GitHub Actions for:

- CI checks on push and pull request.
- Manual Windows EXE/artifact builds.
- Manual release packaging.
- Manual EventFlow audit runs.

Before publishing a release, run the Windows build workflow and confirm install.exe opens correctly on Windows, installs the app, creates shortcuts, and launches SiteShot Auditor Studio.

SAFE SECURITY SCOPE

Security checks are passive and non-invasive. SiteShot does not exploit, brute force, inject payloads, bypass authentication, fuzz forms or perform destructive testing.

The passive checks look at headers, cookie flags, public page source, browser-visible behaviour and common accidental exposure paths by status code only.

CURRENT VERSION SUMMARY

v3.2.23 confirms:

- Exact pages remains the default.
- Auto and Sitemap start immediately when selected.
- Auto and Sitemap show visible animated working states.
- Discovery functions sit outside switchView so tab clicks remain wired correctly.
- Stale discovery results are ignored after mode changes.
- Last Run empty-state feedback works.
- Topbar and sidebar Last Run controls are actionable.
- Last Run uses the newest saved run.
- The beefier crawler and richer link harvesting are retained.
