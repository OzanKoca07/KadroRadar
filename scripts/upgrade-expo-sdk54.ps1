param([ValidateSet('53','54')][string]$Target)
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Set-Location $root
if (-not (Test-Path 'apps/mobile/package.json')) { throw 'KadroRadar monorepo kokunde calistirilmalidir.' }
if (git status --porcelain) { throw 'Once git degisikliklerini commit/stash yapin. Temiz working tree gerekli.' }
$before = node -p "require('./apps/mobile/package.json').dependencies.expo"
Write-Host "Current Expo declaration: $before" -ForegroundColor Cyan
if ($Target -eq '53' -and $before -notmatch '52') { throw 'SDK 53 adimi SDK 52 uzerinden yapilmalidir.' }
if ($Target -eq '54' -and $before -notmatch '53') { throw 'SDK 54 adimi SDK 53 tamamlandiktan sonra yapilmalidir.' }
Write-Host "Installing Expo SDK $Target ..." -ForegroundColor Cyan
pnpm --filter @kadro/mobile add "expo@~$Target.0.0"
if ($LASTEXITCODE -ne 0) { throw 'Expo kurulumu basarisiz' }
Push-Location apps/mobile
try {
  pnpm exec expo install --fix
  if ($LASTEXITCODE -ne 0) { throw 'expo install --fix failed' }
  pnpm dlx expo-doctor
  if ($LASTEXITCODE -ne 0) { throw 'expo-doctor failed: investigate before proceeding' }
  pnpm exec expo export --platform android --output-dir .expo-upgrade-check
  if ($LASTEXITCODE -ne 0) { throw 'Android export failed: do not proceed' }
} finally { Pop-Location }
Write-Host 'Android JS export succeeded. Test Expo/dev build on physical phone before committing.' -ForegroundColor Green
