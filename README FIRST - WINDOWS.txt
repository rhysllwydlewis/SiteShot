SITE SHOT AUDITOR STUDIO ULTRA v3.2.23 - UX AND DEFAULT FLOW BUILD

This version improves the default user flow and fixes small UI quality issues found after v3.2.8.

WHAT CHANGED

SAME-VERSION PATCH

- In Auto Discover mode, the manual page textarea is now hidden.
- The user should press Discover Pages to generate the reviewable page list.
- Exact Pages, Crawl Website and Use Sitemap still show the page/preview box where useful.


1. Auto Discover is now the first scope option
   - Auto Discover is now shown before Exact Pages.
   - Auto Discover is selected by default.
   - This is the best default because the app can find, validate and clean the page list before auditing.

2. Exact Pages is still available
   - Exact Pages has moved to the second option.
   - When selected, the manual example page list is restored.
   - Manual URLs are still validated for slash / non-slash route behaviour before auditing.

3. Default page box is cleaner
   - In Auto Discover mode, the page box starts blank.
   - The box explains that pages will appear after discovery.
   - A blank page list in Auto/Crawl/Sitemap mode means discovery will happen during audit.

4. Bulk delete button sizing fixed
   - Select all, Clear and Bulk delete selected now share the same height.
   - The bulk delete button keeps its red warning style but no longer looks oversized.

5. Discovery flow polished
   - Page count now says Discovery ready when Auto Discover is selected and the list is blank.
   - Clear discovered now resets the discovery state more cleanly.
   - Crawl and Sitemap modes keep their distinct behaviour.

6. Previous fixes retained
   - Reviewed discovery page list is respected by audit.
   - Full Professional Report is first/default report style.
   - Audit Runs and Reports show report type badges.
   - Legacy runs show unknown report type honestly.
   - Selected report is standalone.
   - Report type switcher removed from report header.
   - Report style outputs.
   - Basic / Quick Report.
   - Route/trailing slash fallback.
   - 404 suppression.
   - De-duplicated report scoring.
   - Report delete and bulk delete.
   - Report path fix.
   - Expandable live audit log.
   - Sidebar hide/show burger button.
   - Auth gate awareness without login.
   - Safe forms/flow dry run without submission.
   - Stable no-NSIS EXE build route.

HOW TO USE

1. Extract this zip.
2. Optional but recommended:

   UNBLOCK WINDOWS FILES.bat

3. Run:

   BUILD WINDOWS EXE.bat

4. Run from the Desktop shortcut or:

   %LOCALAPPDATA%\Programs\SiteShot Auditor Studio\SiteShot Auditor Studio.exe

IMPORTANT

Use v3.2.23 instead of v3.2.8.


ADDITIONAL SAME-VERSION PATCH

- Sidebar icons rebuilt to better match their purpose.
- Discover Pages now shows a discovering state and clearer completion feedback.
- Discovery actions now update visible status text.
- After discovery, the page box reappears and is filled with the discovered page list.


FINAL BUTTON REPAIR - SAME VERSION 3.2.23

- Removed duplicate/half-broken discovery handlers.
- Fixed inline browser JavaScript so buttons load again.
- Confirmed Discover Pages uses window.siteshot.discoverPages.
- Added browser-script syntax checking to preflight.


FINAL CLEAN BUTTON REPAIR - SAME VERSION 3.2.23

- Fixed browser-side JavaScript and discovery handlers.
- Confirmed inline script syntax and preflight pass.
- Confirmed Discover Pages uses the correct Electron bridge.


v3.2.23 STABILITY PASS

- Repaired the inline front-end script that caused buttons to fail.
- Rebuilt the discovery button handlers from a single clean source.
- Confirmed Discover Pages uses window.siteshot.discoverPages.
- Added/retained browser-script syntax checking in preflight.
- Improved visible discovery feedback.
- Rebuilt the actual sidebar icons as SVGs.


v3.2.23 BUTTON WIRING AUDIT

- Wired top Settings, Minimise and Close buttons.
- Wired burger/sidebar expand-collapse button.
- Wired Need help/documentation card to open the app help docs.
- Wired Expand, Close and Copy Log.
- Wired every right-side report button.
- Wired Export ZIP.
- Confirmed Discover Pages still uses the correct backend bridge.
- Added preflight checks for all visible button wiring.


v3.2.23 QA PASS

- Fixed collapsed sidebar so the new SVG icons remain visible.
- Made Settings button open Settings without calling an unsupported window action.
- Added stronger copy-log fallback.
- Added report button ready/disabled state clarity.
- Made Help card keyboard accessible.
- Added extra preflight checks for these behaviours.


v3.2.23 QA PASS

- Fixed a critical wiring issue where the sidebar burger action was attached to the Capture Mobile Menu checkbox.
- Added a dedicated sidebarToggle ID for the burger/sidebar control.
- Preserved the Capture Mobile Menu checkbox as a normal audit option.
- Added working topbar quick actions for Workspace, Target, Last Run, Preset and Version.
- Added keyboard activation for topbar/help/sidebar controls.
- Improved Discovery failed state so it visibly stops and explains what happened.
- Refreshed report button state after store changes/deletes.


v3.2.23 FINAL QA PASS

- Added a stable ID to the topbar status dot.
- Strengthened the status helper so it targets the actual DOM used by this interface.
- Added duplicate-ID checks to preflight.
- Confirmed the sidebar toggle is not wired to the Capture Mobile Menu checkbox.
- Confirmed the Capture Mobile Menu checkbox remains a normal audit option.
- Added explicit no-drag rules to topbar/action buttons so they remain clickable inside the draggable app header.


v3.2.23 DISCOVERY BUTTON FIX

- Restored missing getChecked(selector), which was causing Discover Pages to fail before any visible button state changed.
- Replaced the fragile discover onclick with runDiscoveryFromButton().
- Added wireDiscoveryButtons() using addEventListener.
- Discover Pages now immediately changes to Preparing discovery / Discovering pages before IPC starts.
- Added a short repaint delay so the loading state is visible.
- Added setup-error and bridge-error feedback in the discovery panel.
- Made discovery buttons explicit type="button".
- Added preflight checks for the full Discover Pages click flow.


v3.2.23 QA PASS

- Added timeout protection around Discover Pages so it cannot sit silently forever.
- Improved Discover Pages running feedback text.
- Strengthened the disabled/busy state for Discover Pages.
- Added a critical UI startup validator.
- Added disabled/busy CSS for Discover Pages.
- Confirmed discovery button type/button wiring remains intact.
- Added further preflight checks for discovery timeout, button state and critical UI controls.


v3.2.23 DISCOVERY RELIABILITY

- Tidied the Discovery Results panel layout so long messages are readable.
- Replaced rough wait/error rows with polished working/error/fallback rows.
- Backend Auto Discover now has a 90-second safety timeout.
- If full discovery times out, the app returns a safe starter page list instead of failing.
- Discovery preview is capped to 80 pages and depth 2 to avoid long-running previews.
- Renderer timeout increased to allow backend fallback to return cleanly.


v3.2.23 DISCOVERY QUALITY

- Added low-yield discovery detection.
- If Auto/Crawl only validates one page, the app now treats it as limited discovery rather than a full success.
- Added clearer messaging for auth-gated, crawler-resistant and app-driven sites.
- Added richer starter/public fallback routes.
- Added platform route hints for large gated platforms such as Facebook, LinkedIn, Instagram and X/Twitter.
- Added UI notice when only one public page is discovered.
- Updated fallback wording from timeout-only to limited discovery.


v3.2.23 AUTO DISCOVERY FLOW

- Simplified Target & Scope to Exact Pages, Auto and Sitemap.
- Exact Pages is now the default.
- Removed the visible Discover Pages / Select all / Clear discovered buttons from the main flow.
- Auto and Sitemap start discovery automatically when selected.
- Switching scope mode cancels/ignores the previous discovery result.
- Crawl mode is removed from the UI and treated as Auto if an old config references it.
- Beefed up crawling by opening common menu/navigation controls before collecting links.
- Link collection now reads anchors, area links, data-href/data-url/data-link/to attributes and URL-like values in script data.


v3.2.23 PRE-MERGE QA

- Confirmed the requested Target & Scope flow is in place: Exact Pages, Auto and Sitemap only.
- Confirmed Exact Pages is the default.
- Confirmed Auto and Sitemap start automatically when selected.
- Fixed a stale discovery busy-state issue that could stop a later Auto/Sitemap run.
- Exact mode now hides the discovery status and closes the discovery panel.
- Switching discovery modes now clears stale auto-discovery state and ignores previous results.
- Preserved discovery working/error/fallback/low-yield UI helpers.
- Auto/Sitemap help text now clearly states that discovery starts immediately.
- Confirmed the beefier crawler opens common navigation/menu controls and harvests richer link sources.


v3.2.23 FINAL POLISH

- Added final visual polish to the Target & Scope tabs, helper text, discovery status and discovery panel.
- Auto/Sitemap now show an immediate polished preparation row when selected.
- Added a final startup UI sanity check for Exact/Auto/Sitemap scope tabs.
- Confirmed Exact Pages remains the default.
- Confirmed Crawl Website remains removed from the UI.
- Confirmed Auto and Sitemap discovery still start automatically when selected.
- Confirmed beefier crawler and richer link harvesting are retained.


v3.2.23 TAB/LAST RUN FIX

- Fixed Auto/Sitemap tab click wiring by moving discovery functions out of the switchView function.
- Added an animated spinner state to the selected Auto/Sitemap tab while discovery is preparing/running.
- Auto/Sitemap now shows a visible started message and preparing row immediately.
- The tab spinner clears when discovery finishes, fails, or is superseded.
- Last Run now gives helpful empty-state feedback when no audit has been run yet.
- Last Run topbar and sidebar values now refresh from saved run data.


v3.2.23 FINAL VERIFICATION

- Rechecked the v3.2.22 Auto/Sitemap tab fix.
- Confirmed discovery functions remain outside switchView.
- Confirmed Auto/Sitemap tab animation and auto-start behaviour remain intact.
- Last Run now uses the newest saved run by createdAt rather than assuming the first store item is newest.
- Sidebar Last Run card is now clickable/actionable like the topbar Last Run control.
- Last Run empty-state styling now applies to both topbar and sidebar.
