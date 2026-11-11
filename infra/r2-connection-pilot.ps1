param([string]$Endpoint, [switch]$ValidateOnly)
$ErrorActionPreference = 'Stop'
$names = @('R2_ENDPOINT','R2_BUCKET','R2_ACCESS_KEY_ID','R2_SECRET_ACCESS_KEY','R2_PILOT_APPROVED','R2_PILOT_CONFIRMATION')
$saved = @{}
foreach ($name in $names) { $saved[$name] = [Environment]::GetEnvironmentVariable($name,'Process') }
function Read-PrivateValue([string]$Prompt) {
 $secureValue = Read-Host $Prompt -AsSecureString
 $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureValue)
 try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer) }
 finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer); $secureValue.Dispose() }
}
try {
 if ($env:DATABASE_URL) { throw 'R2_PILOT_DATABASE_ENV_REJECTED: run in a fresh operator terminal without DATABASE_URL.' }
 $env:R2_BUCKET = 'kadrooradar-source-cache'
 if ($Endpoint) {
  $env:R2_ENDPOINT = $Endpoint
  $endpointSource = 'ARGUMENT'
 } else {
  $enteredEndpoint = Read-Host 'Exact R2_ENDPOINT (blank uses inherited R2_ENDPOINT; never include credentials)'
  if ($enteredEndpoint) { $env:R2_ENDPOINT = $enteredEndpoint; $endpointSource = 'PROMPT' }
  elseif ($env:R2_ENDPOINT) { $endpointSource = 'ENVIRONMENT' }
  else { $endpointSource = 'MISSING' }
 }
 Write-Output (@{ event='R2_PILOT_INPUT'; endpointSource=$endpointSource; validateOnly=[bool]$ValidateOnly } | ConvertTo-Json -Compress)
 if (-not $ValidateOnly) {
  $confirm = Read-Host 'One small JSON will be written/read/deleted. Type: R2 kadrooradar-source-cache ONE OBJECT'
  if ($confirm -cne 'R2 kadrooradar-source-cache ONE OBJECT') { throw 'R2_PILOT_NOT_APPROVED' }
 }
 $env:R2_ACCESS_KEY_ID = Read-PrivateValue 'R2_ACCESS_KEY_ID (hidden)'
 $env:R2_SECRET_ACCESS_KEY = Read-PrivateValue 'R2_SECRET_ACCESS_KEY (hidden)'
 if ($ValidateOnly) {
  $env:R2_PILOT_APPROVED = 'false'
  $env:R2_PILOT_CONFIRMATION = ''
  & node.exe (Join-Path $PSScriptRoot 'r2-connection-pilot.cjs') --validate-only
 } else {
  $env:R2_PILOT_APPROVED = 'true'
  $env:R2_PILOT_CONFIRMATION = $confirm
  & node.exe (Join-Path $PSScriptRoot 'r2-connection-pilot.cjs')
 }
 $pilotExit = $LASTEXITCODE
} finally {
 foreach ($name in $names) { [Environment]::SetEnvironmentVariable($name,$saved[$name],'Process') }
}
exit $pilotExit
