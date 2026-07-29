# Threat model

EvidenceQuorum defends against common completion-policy failures:

- **self-approval:** independent criteria reject the executor and producer as verifier;
- **single-source confidence:** quorum counts distinct verifier identities;
- **stale proof:** criterion-specific freshness windows reject old receipts;
- **happy-path-only proof:** a negative-path tag can be mandatory;
- **evidence double counting:** cross-criterion digest reuse blocks the audit;
- **contradictory proof:** fresh accepted failures block the relevant criterion;
- **goalpost movement:** contract diff reports removed or weakened controls;
- **certificate editing:** canonical hashes reveal payload changes.

## Out of scope

The engine does not:

- fetch an artifact and check that its bytes match the receipt digest;
- authenticate actor identities;
- prove that a verifier is honest or truly independent;
- sign certificates or provide non-repudiation;
- prevent collusion among verifiers;
- replace domain-specific tests, reviews, or safety evaluation;
- guarantee that a contract captures every real-world requirement.

## Production hardening

Use signed receipts, workload identities, append-only storage, protected baseline contracts, trusted timestamps, artifact-content verification, and separation of duties. Treat provisional certificates as incomplete. Require human review for safety-critical or irreversible operations.
