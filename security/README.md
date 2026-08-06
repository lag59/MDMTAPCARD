# Container Vulnerability Management

This repository uses Docker Scout with two rules:

1. Fail on fixable critical/high CVEs.
2. Allow only explicitly-listed, currently not-fixed OS critical/high CVEs.

## Local workflow

Build image:

```powershell
docker build -f apps/api/Dockerfile -t mdmtapcard-api:latest apps/api
```

View Scout base-image recommendations:

```powershell
docker scout recommendations mdmtapcard-api:latest
```

Run the gate locally:

```powershell
.\.venv\Scripts\python.exe scripts\scout_gate.py --image mdmtapcard-api:latest --exceptions-file security/scout_unfixed_os_exceptions.json
```

## Exceptions

Allowed exceptions are stored in:

- security/scout_unfixed_os_exceptions.json

Each CVE exception should include:

- package
- reason
- review_by (ISO date)

The gate fails if:

- a new unfixed OS critical/high CVE appears and is not listed
- an exception has an expired review_by date

## CI gate

GitHub Actions workflow:

- .github/workflows/api-scout-gate.yml

It performs:

1. Build API image.
2. Print Scout recommendations.
3. Run Scout gate script.
4. Attempt Chainguard compatibility build as a non-blocking informational job.

## Experimental Chainguard path

An experimental Chainguard-style image is available at:

- apps/api/Dockerfile.chainguard

Current status:

- Chainguard latest uses Python 3.14.
- Dependency pins were upgraded for Python 3.14 compatibility (notably pydantic and psycopg[binary]).
- CI now runs a non-blocking Chainguard compatibility build and publishes logs as an artifact.
- Local validation currently passes: apps/api/Dockerfile.chainguard builds and Scout reports 0 vulnerabilities for mdmtapcard-api:chainguard.
- Keep this job non-blocking while compatibility is tracked over time.
