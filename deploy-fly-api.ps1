param(
    [switch]$LocalBuild
)

$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$apiDir = Join-Path $repoRoot 'apps\api'
$flyToml = Join-Path $apiDir 'fly.toml'
$dockerfile = Join-Path $apiDir 'Dockerfile'

if (-not (Get-Command fly -ErrorAction SilentlyContinue)) {
    throw "Fly CLI is not installed or is not available in PATH."
}

if (-not (Test-Path $flyToml)) {
    throw "fly.toml not found: $flyToml"
}

if (-not (Test-Path $dockerfile)) {
    throw "Dockerfile not found: $dockerfile"
}

Write-Host "Deploying FastAPI app with Fly..." -ForegroundColor Cyan
Write-Host "API directory: $apiDir"
Write-Host "Config: $flyToml"
Write-Host "Dockerfile: $dockerfile"

Push-Location $apiDir

try {
    if ($LocalBuild) {
        & fly deploy --config fly.toml --dockerfile Dockerfile
    }
    else {
        & fly deploy --config fly.toml --dockerfile Dockerfile --remote-only
    }

    if ($LASTEXITCODE -ne 0) {
        throw "Fly deployment failed with exit code $LASTEXITCODE."
    }

    Write-Host "FastAPI deployment completed successfully." -ForegroundColor Green
}
finally {
    Pop-Location
}