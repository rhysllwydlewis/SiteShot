# Security policy

SiteShot Auditor Studio Ultra performs safe passive website checks only.

## Supported version

The current supported version is v3.2.23.

## Safe testing scope

SiteShot is designed for passive inspection and browser-visible checks. It does not perform exploit attempts, credential attacks, destructive testing, payload injection, brute-force activity or authentication bypass.

Safe checks include:

- HTTP response headers
- cookie flags visible to the browser
- CSP, HSTS, referrer policy and permissions policy signals
- mixed content signals
- public source and DOM inspection
- public status-code checks for common accidental exposure paths
- directory listing indicators
- sourcemap references
- server disclosure headers
- insecure form-action signals

## Reporting a security concern

If you find a security concern in SiteShot itself, avoid posting sensitive exploit details publicly. Contact the maintainer privately where a private contact route is available. If no private contact route is available, open a minimal GitHub issue that describes the affected area without sharing exploit detail, credentials, secrets or sensitive logs.

When reporting, include:

- affected version
- short summary
- reproduction steps
- expected behaviour
- actual behaviour
- screenshots or logs where useful, with secrets removed

## Out of scope

Do not use SiteShot for unauthorised testing of third-party systems. Only audit websites you own, manage, or have permission to review.
