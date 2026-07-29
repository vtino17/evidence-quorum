# Security policy

## Supported versions

This experimental project currently supports the latest release on the default branch.

## Reporting a vulnerability

Please use GitHub private vulnerability reporting for sensitive findings. Do not open a public issue containing an exploit, secret, or private artifact. Include the affected command or module, a minimal reproduction, expected impact, and any suggested mitigation.

## Important limitation

EvidenceQuorum is a policy engine, not an identity provider, signature service, sandbox, or artifact verifier. Receipt fields are trusted inputs unless your integration authenticates them. Read [docs/THREAT-MODEL.md](docs/THREAT-MODEL.md) before production use.
