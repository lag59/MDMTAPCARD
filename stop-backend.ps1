param(
    [switch]$RemoveVolumes,
    [switch]$RemoveOrphans
)

$ErrorActionPreference = 'Stop'

function Write-Step {
    param([string]$Message)
    Write-Host "`n==> $Message" -ForegroundColor Cyan
}

$downArgs = @('compose', 'down')
if ($RemoveVolumes) {
    $downArgs += '-v'
}
if ($RemoveOrphans) {
    $downArgs += '--remove-orphans'
}

Write-Step 'Stopping backend containers'
& docker @downArgs

Write-Step 'Backend stopped'
if ($RemoveVolumes) {
    Write-Host 'Volumes were removed.' -ForegroundColor Yellow
} else {
    Write-Host 'Volumes were preserved.' -ForegroundColor Green
}
