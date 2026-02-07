$ErrorActionPreference = 'Stop'

function Require-Command {
  param([string]$Name)
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "Required command not found: $Name"
  }
}

Require-Command npm
Require-Command wsl

$websiteDir = Join-Path $PSScriptRoot '..'
$websiteDir = (Resolve-Path $websiteDir).Path

$keyPath = Join-Path $env:USERPROFILE ".tauri\\aether.key"
if (-not (Test-Path $keyPath)) {
  throw "Private key not found at $keyPath"
}

$privateKey = Get-Content -Raw $keyPath
$password = Read-Host -AsSecureString "Enter TAURI signing key password (leave blank if none)"
$passwordPlain = if ($password.Length -gt 0) {
  [Runtime.InteropServices.Marshal]::PtrToStringUni([Runtime.InteropServices.Marshal]::SecureStringToBSTR($password))
} else {
  ""
}

Write-Host "Building Windows bundle..." -ForegroundColor Cyan
Push-Location $websiteDir
try {
  $env:TAURI_SIGNING_PRIVATE_KEY = $privateKey
  if ($passwordPlain) {
    $env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = $passwordPlain
  } else {
    Remove-Item Env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD -ErrorAction SilentlyContinue
  }

  npm run tauri:build
} finally {
  Pop-Location
}

Write-Host "Building Linux bundle via WSL..." -ForegroundColor Cyan
$wslKeyPath = "/mnt/c/Users/danie/.tauri/aether.key"
$wslWebsiteDir = $websiteDir -replace '^([A-Za-z]):', '/mnt/$1' -replace '\\','/'
$wslWebsiteDir = $wslWebsiteDir.ToLower()

$wslPasswordExport = if ($passwordPlain) { "export TAURI_SIGNING_PRIVATE_KEY_PASSWORD='$passwordPlain';" } else { "" }
$wslCommand = @'
set -e
cd "__WSL_DIR__"
export TAURI_SIGNING_PRIVATE_KEY="$(cat "__WSL_KEY__")"
__WSL_PASSWORD__
npm run tauri:build
'@
$wslCommand = $wslCommand.Replace('__WSL_DIR__', $wslWebsiteDir).Replace('__WSL_KEY__', $wslKeyPath).Replace('__WSL_PASSWORD__', $wslPasswordExport)

wsl -u daniel bash -lc $wslCommand

Write-Host "Generating updater JSON..." -ForegroundColor Cyan
Push-Location $websiteDir
try {
  node scripts/generate-updater-json.js
} finally {
  Pop-Location
}

Write-Host "All builds complete." -ForegroundColor Green
