# Completion contract reference

A completion contract states what must be true before an executor may claim that a goal is complete. Version `1.0` is intentionally compact and JSON-native.

## Top-level fields

| Field | Type | Meaning |
| --- | --- | --- |
| `schemaVersion` | `"1.0"` | Contract format version. |
| `id` | string | Stable identifier for the completion claim. |
| `goal` | string | Human-readable outcome. |
| `executor` | actor ID | Agent or system performing the work. |
| `actors` | array | Declared humans, agents, and services. |
| `criteria` | array | Acceptance criteria and their evidence policy. |
| `evidence` | array | Receipts offered to satisfy criteria. |

## Acceptance criteria

Each criterion contains:

- `critical`: failed critical controls block completion; failed noncritical controls create warnings.
- `minPassing`: minimum number of distinct verifiers attached to accepted passing receipts.
- `maxAgeMinutes`: maximum receipt age at audit time.
- `independentVerifier`: rejects a receipt when the verifier is either the executor or its producer.
- `requiredEvidenceTypes`: any of `test`, `observation`, `artifact`, `review`, and `metric`.
- `requiredTags`: optional tags that must appear across accepted passing receipts.
- `negativeTestRequired`: requires the `negative` tag on accepted passing evidence.

The quorum counts verifier identities, not receipt count. Ten receipts from one verifier still provide a quorum of one.

## Evidence receipts

A receipt contains:

| Field | Meaning |
| --- | --- |
| `id` | Unique receipt identifier. |
| `criterionId` | Criterion this receipt supports or contradicts. |
| `type` | Evidence category. |
| `producedBy` | Actor that created the underlying result. |
| `verifiedBy` | Actor that validated it. |
| `capturedAt` | ISO timestamp used by the freshness rule. |
| `outcome` | `pass` or `fail`. A fresh accepted failure contradicts completion. |
| `artifactRef` | Location or external identifier. |
| `digest` | 64-character SHA-256 hex digest. |
| `tags` | Policy labels such as `negative`, `staging`, or a commit ID. |
| `details` | Short human-readable result. |

## Status

- `ready`: every criterion passes and there are no warnings.
- `warning`: all critical criteria pass but one or more noncritical criteria fail.
- `blocked`: a critical control, structural requirement, or anti-reuse rule fails.

A ready audit produces a `certified` certificate. A warning audit may produce a `provisional` certificate. A blocked audit cannot be certified.
