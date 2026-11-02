param([ValidateSet('before','after')][string]$Phase='before',[ValidateSet('backup','verify')][string]$Action='backup',[string]$OperationId)
$ErrorActionPreference='Stop'
if($Action -eq 'verify'){
 try {& node (Join-Path $PSScriptRoot 'migration16-backup.cjs') verify $OperationId;exit $LASTEXITCODE}
 catch {Write-Output '{"status":"FAIL","verified":false,"backupReceiptStatus":"NOT_VERIFIED","code":"M16B_VERIFY_LAUNCH_FAILED"}';exit 1}
}
$names=@('OSYM_DATABASE_URL','OSYM_DATABASE_HOST','OSYM_DATABASE_NAME','OSYM_DATABASE_PORT','M16_BACKUP_APPROVAL','M16_BACKUP_DIRECTORY')
$previous=@{};foreach($name in $names){$previous[$name]=[Environment]::GetEnvironmentVariable($name,'Process')}
$operatorExit=0
try {
 Import-Module (Join-Path $PSHOME 'Modules\Microsoft.PowerShell.Security\Microsoft.PowerShell.Security.psd1') -ErrorAction Stop
 $root=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
 $env:M16_BACKUP_DIRECTORY=Join-Path $root ('.local\migration16-backups\'+[guid]::NewGuid().ToString())
 . (Join-Path $PSScriptRoot 'private-directory.ps1')
 $null=Protect-KadroPrivateDirectory -Path $env:M16_BACKUP_DIRECTORY
 $env:OSYM_DATABASE_HOST=(Read-Host 'Exact Render external hostname').Trim()
 $env:OSYM_DATABASE_NAME=(Read-Host 'Exact Render database name').Trim()
 $env:OSYM_DATABASE_PORT='5432'
 Write-Host 'This reads the database and saves ALL application data locally. No source writes or migrations.'
 $env:M16_BACKUP_APPROVAL=Read-Host "Type BACKUP $($env:OSYM_DATABASE_HOST)/$($env:OSYM_DATABASE_NAME) $Phase"
 $secure=Read-Host 'Render external URL (hidden; never share in chat)' -AsSecureString
 $pointer=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
 try {$env:OSYM_DATABASE_URL=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)}finally{[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)}
 & node (Join-Path $PSScriptRoot 'migration16-backup.cjs') $Phase
 if($LASTEXITCODE){$operatorExit=1}
} catch {Write-Output '{"status":"FAIL","verified":false,"backupReceiptStatus":"NOT_VERIFIED","code":"M16B_INPUT_OR_LAUNCH_FAILED"}';$operatorExit=1}
finally {foreach($name in $names){[Environment]::SetEnvironmentVariable($name,$previous[$name],'Process')};if($secure){$secure.Dispose()}}
exit $operatorExit
