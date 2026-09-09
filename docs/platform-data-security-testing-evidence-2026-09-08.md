# MDM TapCard Platform Data Security Testing Evidence

**Assessment date:** September 8, 2026

**Assessment type:** Security validation and vulnerability review (not a formal penetration test)

**Systems in scope:**

- Next.js web application hosted on Vercel;
- FastAPI backend hosted on Fly.io;
- PostgreSQL persistence;
- Facebook and Instagram OAuth callbacks and token processing;
- AutoGallery media approval and public gallery API;
- Netlify server-side gallery function;
- Container image and JavaScript production dependencies.

## Methodology

The assessment used the following methods:

1. Static Python compilation across the API application and entry point.
2. TypeScript compiler validation for the web application.
3. Targeted ESLint validation for changed frontend files.
4. Manual source review of authentication, OAuth state validation, tenant/business authorization, encrypted token storage, hashed API keys, approved-only media exposure, and secret handling.
5. Automated social smoke testing for approved-only exposure, missing/invalid API keys, and cross-business isolation.
6. Dependency vulnerability scanning with `npm audit --omit=dev --audit-level=high`.
7. Review of the repository Docker Scout CI gate, which scans API container images for fixable critical/high CVEs and requires dated exceptions for unfixed OS CVEs.
8. Production health verification for the Vercel website and Fly.io API.

## Results

### Static and application security checks

- Python compilation: **PASS**
- TypeScript compilation: **PASS**
- Targeted ESLint checks: **PASS**
- Production API health check: **PASS** (`https://mdm-tapcard-api.fly.dev/health` returned HTTP 200)
- Production website availability check: **PASS** (`https://mdmsolutionlab.com` returned HTTP 200)
- Social tenant-isolation smoke test: **PASS**
  - Approved media is returned only after approval.
  - Missing API key returns 401.
  - Invalid API key returns 401.
  - A key from another business cannot access the target business and returns 403.
- OAuth token handling review: **PASS** for server-side exchange, encrypted token storage, signed state, and no social passwords stored.
- TLS review: **PASS** for public application endpoints, which use HTTPS.

### Vulnerability findings

The initial JavaScript production dependency scan reported three findings:

| Finding | Severity | Status | Platform Data risk assessment |
| --- | ---: | --- | --- |
| `next` | Critical | **Remediated** | Updated to the patched `16.3.4` release; no unauthorized Platform Data access was demonstrated. |
| `nanoid` | High | **Remediated** | Resolved by `npm audit fix`; no unauthorized Platform Data access was demonstrated. |
| `sharp` | High | **Remediated** | Resolved by `npm audit fix`; no unauthorized Platform Data access was demonstrated. |

Follow-up validation on September 8, 2026 returned **0 vulnerabilities** from `npm audit --omit=dev --audit-level=high --json`. The production web build also passed after the updates.

The API container vulnerability process is enforced by `.github/workflows/api-scout-gate.yml` and `scripts/scout_gate.py`. The gate fails on fixable critical/high vulnerabilities. Unfixed OS CVEs are permitted only when listed with a reason and review date in `security/scout_unfixed_os_exceptions.json`.

No formal internal or external penetration test was performed as part of this assessment. No public vulnerability disclosure or bug bounty program was used for this assessment.

## Triage and remediation

The Critical `next` finding and High `nanoid` and `sharp` findings were assigned **High/Critical priority** because the systems process Platform Data. The remediation owner updated or repaired the affected dependency paths, reran `npm audit`, reran static/type checks, and completed a production build. All three findings are now remediated based on the clean follow-up scan.

Target remediation:

- Critical: contain immediately and remediate or mitigate within 24 hours where practical.
- High: remediate or mitigate within 7 calendar days.

No finding is considered closed without a repeat scan. The follow-up scan returned zero high or critical vulnerabilities, so no exception was needed for these JavaScript dependencies.

## Evidence and limitations

This document is a dated security validation summary aligned with the selected controls: static testing, vulnerability scanning, automated security testing, and manual review. It is not a penetration-test report. The initial findings and remediation evidence are included for transparency.

**Prepared:** September 8, 2026
