# Security Policy

## Supported baseline

Security reports should target the current default branch. GridPulse is an evolving portfolio project and does not currently provide a production support or vulnerability-response SLA.

## Reporting a vulnerability

Please do not publish exploitable details, credentials, customer data, or proof-of-concept payloads in a public issue.

If GitHub private vulnerability reporting is enabled for this repository, use the repository's Security, Advisories, Report a vulnerability flow. Otherwise, contact the repository maintainer privately through GitHub before sharing technical details.

Include:
- A concise description and affected component or endpoint.
- Preconditions and a reproducible impact summary.
- A minimal proof of concept that does not access third-party data.
- Suggested mitigation, if known.

## Scope and handling

- Never test against systems, accounts, or telemetry that you do not own or have explicit permission to assess.
- Do not include live credentials, gateway signing secrets, encryption keys, or personal data in reports.
- Rotate any credential that may have been exposed.
- A report is not a claim that the project is certified or independently audited.

## Security-sensitive configuration

- Keep the environment file untracked and use a secret manager in hosted environments.
- Use a strong JWT access secret and a persistent gateway encryption key.
- Restrict CORS to trusted origins and use HTTPS with secure cookies.
- Back up the gateway encryption key separately from the encrypted database values.
