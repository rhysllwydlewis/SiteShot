# Safe Passive Security Scope

Allowed:

- HTTP response headers
- Cookie flags visible to the browser
- CSP/HSTS/referrer/permissions policy checks
- Mixed content checks
- Public source and DOM inspection
- Common exposure path status checks only
- Directory listing indicators
- Sourcemap references
- Server disclosure headers
- Insecure form action checks

Not allowed / not implemented:

- Exploit attempts
- Payload injection
- SQLi/XSS probing
- Credential attacks
- Brute force
- Rate-intensive scanning
- Destructive testing
- Authentication bypass
