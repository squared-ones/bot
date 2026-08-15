# Security Policy

## Reporting a vulnerability

If you discover a security vulnerability in Squared One, please report it
responsibly. **Do not open a public issue** for security issues.

Please send a report to squared_one@outlook.com with:

- A description of the vulnerability
- Steps to reproduce it
- Affected versions
- Any suggested fix or mitigation (optional)

We will acknowledge your report as soon as possible and work with you to
understand and resolve the issue.

## Supported versions

Security fixes are applied to the `main` branch and published in the latest
release. Only the most recent release is actively supported.

| Version | Supported |
| ------- | --------- |
| Latest (main) | :white_check_mark: |
| Older releases | :x: |

## Security considerations for self-hosters

Squared One is designed to be self-hosted. When running your own instance:

- Set a strong, random `SESSION_SECRET`; never commit `.env`.
- Set `COOKIE_SECURE=true` when serving the dashboard over HTTPS.
- The dashboard `/api/*` endpoints are guarded by Discord OAuth only when
  `CLIENT_ID` and `CLIENT_SECRET` are both set — otherwise the dashboard runs
  **unprotected**. Do not expose an unauthenticated instance publicly.
- Grant the bot only the permissions it needs, and use a least-privilege invite
  scope where possible.
- Keep Node.js and dependencies up to date.

## Scope

This policy applies to the Squared One codebase as distributed in this
repository. Vulnerabilities in third-party dependencies should be reported to
those projects, though we welcome reports describing how they affect Squared
One.
