# MDM TapCard

MDM TapCard is a multi-platform NFC business-card system for MDM Creation:

- Mobile app (`apps/mobile`, Flutter) to write, verify, test, and optionally lock NFC tags
- Web platform (`apps/web`, Next.js) for digital business-card pages and admin views
- API (`apps/api`, FastAPI) for profiles, tags, analytics, leads, and role-based operations

## Monorepo structure

```text
MDMTAPCARD/
  apps/
    web/      # Next.js digital cards + admin
    api/      # FastAPI backend
    mobile/   # Flutter app (iOS + Android NFC)
  docs/
  docker-compose.yml
```

## Quick start

### 1) Database

```bash
docker compose up -d
```

### 2) API

```bash
cd apps/api
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
uvicorn main:app --reload --port 8000
```

### 3) Web

```bash
cd apps/web
npm install
copy .env.local.example .env.local
npm run dev
```

### 4) Mobile

```bash
cd apps/mobile
flutter pub get
flutter run --dart-define=API_URL=http://10.0.2.2:8000
```

> Use `10.0.2.2` for Android emulator localhost mapping. For physical devices, use your LAN IP.

## NFC write flow

1. Select client/profile
2. API reserves tag token and returns URL
3. Mobile app starts NFC session
4. Detect tag and verify NDEF + writable + capacity
5. Write URI record
6. Read back URL and compare
7. Confirm write to API (stores UID/type/capacity/programmer)
8. Optionally lock as read-only with irreversible warning

### NFC writer options (you can do both)

- **Mobile writer (existing):** Use the Flutter admin app in `apps/mobile` to prepare, write, read-back verify, and confirm in one flow.
- **Desktop ACR122U-assisted writer (new):** Use your ACS ACR122U-A9 software for the physical write/read step while this repo's API remains source-of-truth for prepare/confirm.

Desktop-assisted flow script:

```bash
python scripts/nfc_desktop_assist.py --profile-id <PROFILE_UUID>
```

What it does:

1. Authenticates to API
2. Calls prepare endpoint to reserve a tag and get `profile_url`
3. Prompts you to write/read that URL using ACR122U tooling
4. Calls confirm endpoint with your read-back value (and optional UID/type/capacity)

Confirm-only mode (if you already prepared/wrote a tag):

```bash
python scripts/nfc_desktop_assist.py --confirm-only --tag-id <TAG_UUID>
```

## Security principles

- Write only HTTPS short URLs to the NFC tag
- Use random public tag tokens (`?tag=...`)
- Keep full profile data in backend/database
- Enforce role-based permissions in API
- Keep audit records for write/lock actions

## Notes

- iOS requires NFC capability and `NFCReaderUsageDescription`
- Android requires NFC permission and NFC feature declarations
- Do not lock cards by default

## Docker Linux backend runbook (recommended on Windows ARM)

Use this path to avoid native Windows build issues for `asyncpg`.

### Start API + PostgreSQL

```bash
docker compose up -d --build db api
```

### Apply migrations

```bash
docker compose exec -T api python -m alembic upgrade head
```

### Seed demo data

```bash
docker compose exec -T api python seed_demo.py
```

### Run admin API regression tests

See [apps/api/README.md](apps/api/README.md) for the focused admin regression test command and environment variable overrides.

### Verify health and login

```bash
curl http://localhost:8000/health
```

PowerShell login check:

```powershell
$body = @{ email='admin@mdmcreation.com'; password='ChangeMe123!' } | ConvertTo-Json
Invoke-WebRequest -Uri "http://localhost:8000/api/v1/auth/login" -Method Post -ContentType "application/json" -Body $body
```

### View logs / stop stack

```bash
docker compose logs -f api
docker compose down
```

### Runtime note

- API runtime in Docker uses `postgresql+asyncpg://...`.
- Alembic automatically uses a sync psycopg URL internally for migrations.

### Container vulnerability policy

- Docker Scout recommendations + CI gate documentation: [security/README.md](security/README.md)
- Unfixed OS CVE exceptions list: [security/scout_unfixed_os_exceptions.json](security/scout_unfixed_os_exceptions.json)
- API image gate workflow: [.github/workflows/api-scout-gate.yml](.github/workflows/api-scout-gate.yml)

### One-command PowerShell helper

From the repository root:

```powershell
.\start-backend.ps1
```

Optional flags:

```powershell
.\start-backend.ps1 -SkipSeed
.\start-backend.ps1 -NoBuild
```

### Stop helper

```powershell
.\stop-backend.ps1
```

Optional flags:

```powershell
.\stop-backend.ps1 -RemoveVolumes
.\stop-backend.ps1 -RemoveOrphans
```

### Full reset helper

Safe mode (default): recreates containers, rebuilds, migrates, and reseeds demo data
while preserving database volumes (NFC tags remain intact).

```powershell
.\reset-backend.ps1
```

Destructive mode (erases DB volumes and all NFC tag records) requires explicit confirmation:

```powershell
.\reset-backend.ps1 -DestroyData -Confirm ERASE
```

Optional flag:

```powershell
.\reset-backend.ps1 -NoBuild
```

### NFC data durability on updates

- Regular code pushes and container rebuilds do **not** erase NFC cards.
- NFC tag records live in PostgreSQL (`postgres_data` Docker volume).
- Migrations run with `alembic upgrade head` and are additive for NFC tables.
- Data is only erased if volumes are explicitly removed (for example with destructive reset).
