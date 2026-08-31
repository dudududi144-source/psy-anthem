# Security Policy

## Secrets handling
- **NEVER** commit tokens, PATs, or credentials to this repository.
- CI fails the build if a ghp_ / github_pat_ pattern is found anywhere.
- If a secret is ever committed: revoke it immediately at https://github.com/settings/tokens and rotate.

## Push hygiene
Prefer SSH keys over tokens embedded in remote URLs. For automation, prefer the ephemeral GITHUB_TOKEN over long-lived PATs.

## Threat model
Deterministic, local, WHAT-layer engine. No network I/O, no telemetry, no audio, no credentials at runtime.
