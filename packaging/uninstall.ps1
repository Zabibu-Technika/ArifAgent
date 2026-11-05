[CmdletBinding()]
param(
    [string]$InstallDir = (Join-Path $env:LOCALAPPDATA "Zabibu\ArifAgent"),
    [switch]$Purge
)

$ErrorActionPreference = "Stop"

if (Test-Path $InstallDir) {
    Remove-Item $InstallDir -Recurse -Force
    Write-Host "  Removed $InstallDir" -ForegroundColor Green
}
else {
    Write-Host "  $InstallDir is not installed." -ForegroundColor Yellow
}

$userPath = [Environment]::GetEnvironmentVariable("Path", "User")
$parts = @(($userPath -split ";") | Where-Object { $_ -ne "" -and $_ -ne $InstallDir })
[Environment]::SetEnvironmentVariable("Path", ($parts -join ";"), "User")
Write-Host "  Removed $InstallDir from the user PATH." -ForegroundColor Green

Write-Host "  Kept $env:USERPROFILE\.weaver. It is the shared base workspace and receipts." -ForegroundColor DarkGray
if ($Purge) {
    $arifHome = Join-Path $env:USERPROFILE ".arif-agent"
    if (Test-Path $arifHome) {
        Remove-Item $arifHome -Recurse -Force
        Write-Host "  Removed $arifHome." -ForegroundColor Green
    }
}
