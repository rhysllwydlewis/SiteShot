# Troubleshooting

## Node.js is not installed

Install the current LTS version of Node.js, then reopen your terminal or restart Windows before trying again.

## npm install fails

Try these steps:

```bash
npm cache verify
npm install
```

If the failure continues, copy the full terminal output into a bug report.

## Playwright Chromium does not install

Run:

```bash
npm run install:browsers
```

On Linux CI runners, use:

```bash
npm run install:browsers:with-deps
```

## Verification fails

Run the checks separately so you can see which part failed:

```bash
npm run check
npm run check:repo
npm run preflight
```

`npm run check` covers JavaScript syntax checks. `npm run check:repo` checks repository consistency, docs, workflow references and example audit configs. `npm run preflight` checks the app-specific wiring and expected project structure.

## Windows build does not create an EXE

Run the full verification command first:

```bash
npm run verify
```

Then run:

```bash
npm run dist:win
```

Expected output:

```text
release/win-unpacked/SiteShot Auditor Studio.exe
```

## Audit finds only one page

Some websites are heavily app-driven, crawler-resistant or gated behind authentication. In that case:

- use Exact Pages for a controlled page list
- use Sitemap if the site publishes a sitemap
- keep Auto for public sites with normal links and menus

## EventFlow example profiles

Use:

```bash
npm run audit:eventflow:public
```

for public pages only.

Use:

```bash
npm run audit:eventflow:full
```

when you intentionally want to include auth/reset/verify routes.

## Windows blocks downloaded files

Run:

```text
UNBLOCK WINDOWS FILES.bat
```

Then run the app again.
