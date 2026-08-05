param(
    [switch]$NoBuild
)

$ErrorActionPreference = 'Stop'

function Write-Step {
    param([string]$Message)
    Write-Host "`n==> $Message" -ForegroundColor Cyan
}

Write-Step 'Removing backend containers and volumes'
& docker compose down -v --remove-orphans

$upArgs = @('compose', 'up', '-d')
if (-not $NoBuild) {
    $upArgs += '--build'
}
$upArgs += @('db', 'api')

Write-Step 'Recreating database and API containers'
& docker @upArgs

Write-Step 'Applying migrations'
& docker compose exec -T api python -m alembic upgrade head

Write-Step 'Seeding demo data'
& docker compose exec -T api python seed_demo.py

Write-Step 'Checking health endpoint'
$healthResponse = Invoke-WebRequest -Uri 'http://localhost:8000/health' -UseBasicParsing
Write-Host $healthResponse.Content -ForegroundColor Green

Write-Step 'Checking admin login endpoint'
$body = @{ email = 'admin@mdmcreation.com'; password = 'ChangeMe123!' } | ConvertTo-Json
$loginResponse = Invoke-WebRequest -Uri 'http://localhost:8000/api/v1/auth/login' -Method Post -ContentType 'application/json' -Body $body -UseBasicParsing
Write-Host "Login status: $($loginResponse.StatusCode)" -ForegroundColor Green

Write-Step 'Backend reset completed'
Write-Host 'Use: docker compose logs -f api' -ForegroundColor Yellow
