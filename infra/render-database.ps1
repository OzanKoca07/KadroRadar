param(
 [Parameter(Mandatory=$true)][ValidateSet('status','migrate','create-admin')][string]$Action,
 [Parameter(Mandatory=$true)][string]$DatabaseHost,
 [Parameter(Mandatory=$true)][string]$DatabaseName
)
$ErrorActionPreference='Stop'
$root=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$keys=@('DATABASE_URL','NEW_ADMIN_EMAIL','NEW_ADMIN_PASSWORD','NEW_ADMIN_ROLE')
$previous=@{}
foreach($key in $keys){$previous[$key]=[Environment]::GetEnvironmentVariable($key,'Process')}
function Read-PrivateValue([string]$Prompt){
 $secure=Read-Host $Prompt -AsSecureString
 $pointer=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
 try{return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)}
 finally{[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer);$secure.Dispose()}
}
try{
 $env:DATABASE_URL=Read-PrivateValue 'Render External Database URL (hidden; do not paste into command history)'
 $approval=@()
 if($Action -ne 'status'){
  $expected="$Action $DatabaseHost/$DatabaseName"
  Write-Host 'Continue only after separate user approval; migration also requires SQL and backup review.'
  if((Read-Host "Type exactly $expected") -cne $expected){throw 'Confirmation mismatch; no command executed'}
  $approval=@('APPROVE')
 }
 if($Action -eq 'create-admin'){
  $env:NEW_ADMIN_EMAIL=Read-Host 'New admin email'
  $env:NEW_ADMIN_ROLE=Read-Host 'Role: SYSTEM_ADMIN, REVIEWER or CONTENT_EDITOR'
  $env:NEW_ADMIN_PASSWORD=Read-PrivateValue 'New unique password (24+ random characters recommended)'
 }
 & node (Join-Path $root 'infra/render-database.cjs') $Action $DatabaseHost $DatabaseName @approval
 if($LASTEXITCODE){throw 'Database command failed; no automatic retry or reset'}
}finally{
 foreach($key in $keys){[Environment]::SetEnvironmentVariable($key,$previous[$key],'Process')}
}
