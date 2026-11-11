param(
 [Parameter(Mandatory=$true)][ValidateSet('preflight','backup','dry-run','pilot','publish-pilot','remaining','verify')][string]$Action
)
$ErrorActionPreference='Stop'
$root=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$names=@('OSYM_DATABASE_URL','OSYM_DATABASE_HOST','OSYM_DATABASE_PORT','OSYM_DATABASE_NAME','OSYM_IMPORT_APPROVAL','OSYM_ADMIN_EMAIL','OSYM_ADMIN_PASSWORD')
$previous=@{}
foreach($name in $names){$previous[$name]=[Environment]::GetEnvironmentVariable($name,'Process')}
function Plain([Security.SecureString]$value){$ptr=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($value);try{[Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)}finally{[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)}}
try{
 . (Join-Path $PSScriptRoot 'private-directory.ps1')
 $folder=Protect-KadroPrivateDirectory -Path (Join-Path $root '.local\osym-production')
 $env:OSYM_DATABASE_HOST=(Read-Host 'Exact Render External database host (no URL/password)').Trim()
 $env:OSYM_DATABASE_PORT='5432'
 $env:OSYM_DATABASE_NAME=(Read-Host 'Exact Render database name').Trim()
 $secret=Read-Host 'Render External Database URL (hidden; never paste into chat)' -AsSecureString
 $env:OSYM_DATABASE_URL=Plain $secret
 if($Action -in @('pilot','publish-pilot','remaining')){
  Write-Host "Add-only target: $($env:OSYM_DATABASE_HOST):5432/$($env:OSYM_DATABASE_NAME)"
  Write-Host "Confirmation: $($env:OSYM_DATABASE_HOST)/$($env:OSYM_DATABASE_NAME) ADD VERIFIED OSYM"
  $confirmation=Read-Host 'Type the exact confirmation above'
  $env:OSYM_IMPORT_APPROVAL=$confirmation
  $env:OSYM_ADMIN_EMAIL=Read-Host 'Existing SYSTEM_ADMIN account email'
  $adminSecret=Read-Host 'Existing admin password (hidden)' -AsSecureString
  $env:OSYM_ADMIN_PASSWORD=Plain $adminSecret
 }
 & node (Join-Path $PSScriptRoot 'osym-production.cjs') $Action
 if($LASTEXITCODE){throw 'Operation stopped. No automatic retry/reset/migration. Inspect private journal and run preflight/dry-run.'}
}finally{
 foreach($name in $names){[Environment]::SetEnvironmentVariable($name,$previous[$name],'Process')}
 if($secret){$secret.Dispose()};if($adminSecret){$adminSecret.Dispose()}
 Remove-Variable confirmation,adminSecret,secret -ErrorAction SilentlyContinue
}
