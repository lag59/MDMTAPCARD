# Configures Twilio SMS for MDM TapCard by writing/updating the required keys in
# apps/api/.env. Prompts for values in YOUR terminal so the Auth Token is never
# echoed or passed through chat. Optionally pushes the same values to Fly.
#
# Usage:
#   ./setup-twilio.ps1              # write to apps/api/.env
#   ./setup-twilio.ps1 -Fly        # also set Fly secrets (fly secrets set ...)
#   ./setup-twilio.ps1 -Mock       # local testing: log SMS instead of sending

param(
    [switch]$Fly,
    [switch]$Mock,
    [string]$FlyApp = 'mdm-tapcard-api'
)

$ErrorActionPreference = 'Stop'

$envPath = Join-Path $PSScriptRoot 'apps/api/.env'
if (-not (Test-Path $envPath)) {
    throw "Could not find $envPath. Run this from the repository root."
}

function Set-EnvKey {
    param([string]$Key, [string]$Value)
    $lines = Get-Content -LiteralPath $envPath
    $pattern = "^\s*$([regex]::Escape($Key))="
    $newLine = "$Key=$Value"
    if ($lines -match $pattern) {
        $updated = $lines | ForEach-Object { if ($_ -match $pattern) { $newLine } else { $_ } }
    }
    else {
        $updated = $lines + $newLine
    }
    Set-Content -LiteralPath $envPath -Value $updated -Encoding UTF8
}

Write-Host "`n== Twilio SMS setup ==" -ForegroundColor Cyan

$provider = if ($Mock) { 'mock' } else { 'twilio' }

$accountSid = Read-Host 'Twilio Account SID (starts with AC)'
$fromNumber = Read-Host 'Twilio From number (E.164, e.g. +17372583478)'

# Read the Auth Token as a secure string so it is not shown on screen.
$authTokenSecure = Read-Host 'Twilio Auth Token (input hidden)' -AsSecureString
$authToken = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto(
    [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($authTokenSecure)
)

if (-not $accountSid -or -not $authToken -or -not $fromNumber) {
    throw 'Account SID, Auth Token, and From number are all required.'
}

# --- Format validation (catches common paste mistakes) ---
if ($accountSid -notmatch '^AC[0-9a-fA-F]{32}$') {
    throw "Account SID looks wrong. It must start with 'AC' followed by 32 hex characters."
}
if ($authToken -match '^SK') {
    throw "That value is an API Key SID (starts with 'SK'), not the Auth Token. Use the Auth Token from the Twilio Console dashboard (32 hex characters)."
}
if ($authToken -notmatch '^[0-9a-fA-F]{32}$') {
    Write-Warning "Auth Token is not the usual 32 hex characters (got $($authToken.Length)). Double-check it if authentication fails."
}
if ($fromNumber -notmatch '^\+[1-9]\d{6,14}$') {
    throw "From number must be in E.164 format, e.g. +17372583478."
}

Set-EnvKey 'SMS_PROVIDER' $provider
Set-EnvKey 'TWILIO_ACCOUNT_SID' $accountSid
Set-EnvKey 'TWILIO_AUTH_TOKEN' $authToken
Set-EnvKey 'TWILIO_FROM_NUMBER' $fromNumber

Write-Host "Wrote SMS_PROVIDER, TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER to $envPath" -ForegroundColor Green

if ($Fly) {
    Write-Host "`nPushing secrets to Fly app '$FlyApp'..." -ForegroundColor Cyan
    & fly secrets set `
        "SMS_PROVIDER=$provider" `
        "TWILIO_ACCOUNT_SID=$accountSid" `
        "TWILIO_AUTH_TOKEN=$authToken" `
        "TWILIO_FROM_NUMBER=$fromNumber" `
        -a $FlyApp
}

# Best-effort scrub of the plaintext token from memory.
$authToken = $null
[System.GC]::Collect()

Write-Host "`nDone. Restart the API to load the new settings:" -ForegroundColor Yellow
Write-Host "  docker compose restart api" -ForegroundColor Yellow
Write-Host "Then use Admin -> Users -> 'Text credentials' to verify." -ForegroundColor Yellow
