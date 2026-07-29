# Completion certificate

A certificate is a portable record of the criteria that passed an EvidenceQuorum audit.

It includes:

- contract ID and canonical SHA-256 hash;
- issuance time and `certified` or `provisional` status;
- accepted evidence IDs and digests for each passing criterion;
- verifier identities;
- a human-readable Markdown rendering;
- a canonical SHA-256 hash over the certificate payload.

`verify` recomputes the certificate hash, optionally binds it to the supplied contract, rejects duplicated evidence IDs, and checks that every critical criterion is represented.

```bash
evidence-quorum verify certificate.json --contract contract.json
```

The certificate hash detects accidental or unauthorized changes to the JSON payload. It is not a digital signature. If issuer authenticity matters, sign the certificate with Sigstore, an organizational key, or another trusted signing system.
