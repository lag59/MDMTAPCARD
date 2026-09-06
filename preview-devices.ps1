param(
    [int]$WebPort = 3000,
    [switch]$SkipBackend,
    [switch]$NoOpen
)

# Starts the backend API + Next.js web dev server, then opens the responsive
# device preview so you can view every screen on phone, tablet, and mobile web.

$ErrorActionPreference = 'Stop'

function Write-Step {
    param([string]$Message)
    Write-Host "`n==> $Message" -ForegroundColor Cyan
}

$root = $PSScriptRoot
$webDir = Join-Path $root 'apps/web'

if (-not $SkipBackend) {
    Write-Step 'Starting backend (database + API) containers'
    & docker compose up -d --build db api

    Write-Step 'Applying database migrations'
    & docker compose exec -T api python -m alembic upgrade head

    Write-Step 'Checking API health endpoint'
    try {
        $health = Invoke-WebRequest -Uri 'http://localhost:8000/health' -UseBasicParsing -TimeoutSec 15
        Write-Host $health.Content -ForegroundColor Green
    }
    catch {
        Write-Host "API health check failed: $($_.Exception.Message)" -ForegroundColor Yellow
    }
}

if (-not (Test-Path (Join-Path $webDir 'node_modules'))) {
    Write-Step 'Installing web dependencies'
    Push-Location $webDir
    & npm install
    Pop-Location
}

$previewUrl = "http://localhost:$WebPort/preview"

Write-Step "Starting Next.js web dev server on port $WebPort"
Write-Host "Preview URL: $previewUrl" -ForegroundColor Green
Write-Host 'Press Ctrl+C to stop the web server.' -ForegroundColor Yellow

if (-not $NoOpen) {
    # Open the preview shortly after the dev server has time to boot.
    Start-Job -ScriptBlock {
        param($url)
        Start-Sleep -Seconds 6
        Start-Process $url
    } -ArgumentList $previewUrl | Out-Null
}

Push-Location $webDir
try {
    & npm run dev -- --port $WebPort
}
finally {
    Pop-Location
}
