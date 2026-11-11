# Synthetic wrapper contract only. Run in a child with a minimal, secret-free environment.
$ErrorActionPreference = 'Stop'
$names = @('R2_ENDPOINT','R2_BUCKET','R2_ACCESS_KEY_ID','R2_SECRET_ACCESS_KEY','R2_PILOT_APPROVED','R2_PILOT_CONFIRMATION')
foreach ($name in $names) { [Environment]::SetEnvironmentVariable($name,'PREVIOUS_SYNTHETIC','Process') }
$env:R2_ENDPOINT = 'https://old-invalid.example.test'
$env:DATABASE_URL = $null
$global:R2Hidden = 0
$global:R2Calls = 0
$global:R2Confirm = $true
$global:R2MockExit = 0
$global:R2LastEndpoint = ''
$global:R2LastMode = ''
$global:R2PromptEndpoint = 'https://' + ('a' * 32) + '.r2.cloudflarestorage.com/'
function New-SyntheticSecure([string]$Value) {
 $secure = New-Object Security.SecureString
 foreach ($character in $Value.ToCharArray()) { $secure.AppendChar($character) }
 $secure.MakeReadOnly()
 return $secure
}
function global:Read-Host {
 param([string]$Prompt, [switch]$AsSecureString)
 if ($AsSecureString) {
  $global:R2Hidden++
  if ($Prompt -like 'R2_ACCESS_KEY_ID*') { return New-SyntheticSecure ('b' * 32) }
  if ($Prompt -like 'R2_SECRET_ACCESS_KEY*') { return New-SyntheticSecure ('c' * 64) }
  throw 'UNEXPECTED_PRIVATE_PROMPT'
 }
 if ($Prompt -like 'Exact R2_ENDPOINT*') { return $global:R2PromptEndpoint }
 if ($Prompt -like 'One small JSON*') {
  if ($global:R2Confirm) { return 'R2 kadrooradar-source-cache ONE OBJECT' }
  return 'NO'
 }
 throw 'UNEXPECTED_PROMPT'
}
function global:node.exe {
 param([string]$Script, [string]$Mode)
 $global:R2Calls++
 $global:R2LastEndpoint = $env:R2_ENDPOINT
 $global:R2LastMode = $Mode
 if ($env:R2_ACCESS_KEY_ID -cne ('b' * 32) -or $env:R2_SECRET_ACCESS_KEY -cne ('c' * 64)) { throw 'PRIVATE_ENV_TRANSFER_FAILED' }
 if ($env:R2_BUCKET -cne 'kadrooradar-source-cache') { throw 'BUCKET_TRANSFER_FAILED' }
 if ($Mode -eq '--validate-only') {
  if ($env:R2_PILOT_APPROVED -ne 'false') { throw 'VALIDATION_ENABLED_WRITES' }
 } elseif ($env:R2_PILOT_APPROVED -ne 'true' -or $env:R2_PILOT_CONFIRMATION -cne 'R2 kadrooradar-source-cache ONE OBJECT') { throw 'CONFIRMATION_TRANSFER_FAILED' }
 $global:LASTEXITCODE = $global:R2MockExit
 return '{"status":"SYNTHETIC_WRAPPER_ONLY","realRequests":0}'
}
function Assert-Restored {
 foreach ($name in $names) {
  $expected = if ($name -eq 'R2_ENDPOINT') { 'https://old-invalid.example.test' } else { 'PREVIOUS_SYNTHETIC' }
  if ([Environment]::GetEnvironmentVariable($name,'Process') -cne $expected) { throw 'ENVIRONMENT_NOT_RESTORED' }
 }
}
try {
 $wrapper = Join-Path $PSScriptRoot 'r2-connection-pilot.ps1'
 $null = & $wrapper -ValidateOnly
 if ($R2Calls -ne 1 -or $R2Hidden -ne 2 -or $R2LastMode -ne '--validate-only' -or $R2LastEndpoint -cne $R2PromptEndpoint) { throw 'VALIDATE_OR_PROMPT_OVERRIDE_FAILED' }
 Assert-Restored
 $explicit = 'https://' + ('d' * 32) + '.r2.cloudflarestorage.com'
 $null = & $wrapper -Endpoint $explicit
 if ($R2Calls -ne 2 -or $R2Hidden -ne 4 -or $R2LastEndpoint -cne $explicit) { throw 'EXPLICIT_ENDPOINT_FAILED' }
 Assert-Restored
 $global:R2PromptEndpoint = ''
 $null = & $wrapper -ValidateOnly
 if ($R2LastEndpoint -cne 'https://old-invalid.example.test') { throw 'INHERITED_ENDPOINT_FAILED' }
 Assert-Restored
 $global:R2Confirm = $false
 $rejected = $false
 try { $null = & $wrapper -Endpoint $explicit } catch { $rejected = $true }
 if (-not $rejected -or $R2Calls -ne 3 -or $R2Hidden -ne 6) { throw 'CONFIRMATION_GATE_FAILED' }
 Assert-Restored
 $env:DATABASE_URL = 'SYNTHETIC_FORBIDDEN'
 $rejected = $false
 try { $null = & $wrapper -ValidateOnly } catch { $rejected = $true }
 if (-not $rejected -or $R2Calls -ne 3) { throw 'DATABASE_GUARD_FAILED' }
 $env:DATABASE_URL = $null
 Assert-Restored
 $global:R2MockExit = 7
 $null = & $wrapper -ValidateOnly -Endpoint $explicit
 if ($LASTEXITCODE -ne 7) { throw 'NODE_EXIT_NOT_PRESERVED' }
 Assert-Restored
 Write-Output (@{status='PASS';test='r2-pilot-wrapper';checks=12;powerShell=$PSVersionTable.PSVersion.ToString();realRequests=0}|ConvertTo-Json -Compress)
} finally {
 Remove-Item Function:\Read-Host, Function:\node.exe -ErrorAction SilentlyContinue
}
