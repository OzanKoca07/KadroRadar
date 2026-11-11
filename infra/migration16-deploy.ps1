param([ValidateSet('inspect','apply')][string]$Action='inspect',[string]$BackupOperationId)
$ErrorActionPreference='Stop'
$keys=@('OSYM_DATABASE_URL','OSYM_DATABASE_HOST','OSYM_DATABASE_NAME','OSYM_DATABASE_PORT','M16_DEPLOY_OPERATION_ID','M16_DEPLOY_APPROVAL')
$previous=@{};foreach($key in $keys){$previous[$key]=[Environment]::GetEnvironmentVariable($key,'Process')}
$operatorExit=0
try {
 Import-Module (Join-Path $PSHOME 'Modules\Microsoft.PowerShell.Security\Microsoft.PowerShell.Security.psd1') -ErrorAction Stop
 if(-not $BackupOperationId){$BackupOperationId=Read-Host 'Verified BEFORE backup operationId'}
 if($BackupOperationId -notmatch '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'){throw 'INVALID_BACKUP_ID'}
 $env:OSYM_DATABASE_HOST=(Read-Host 'Exact Render external hostname').Trim()
 $env:OSYM_DATABASE_NAME=(Read-Host 'Exact Render database name').Trim();$env:OSYM_DATABASE_PORT='5432'
 $secure=Read-Host 'Render external URL (hidden; never share in chat)' -AsSecureString
 $pointer=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
 try {$env:OSYM_DATABASE_URL=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)}finally{[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)}
 $env:M16_DEPLOY_OPERATION_ID=[guid]::NewGuid().ToString()
 $folder=Join-Path ([IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))) ('.local\migration16-deploy\'+$env:M16_DEPLOY_OPERATION_ID)
 . (Join-Path $PSScriptRoot 'private-directory.ps1');$null=Protect-KadroPrivateDirectory -Path $folder
 $output=& node (Join-Path $PSScriptRoot 'migration16-deploy.cjs') prepare $BackupOperationId
 if($LASTEXITCODE){Write-Output $output;$operatorExit=1}
 else {
  $plan=$output | ConvertFrom-Json
  if($plan.status -eq 'NO_OP'){Write-Output $output}
  elseif($plan.status -ne 'READY_FOR_CONFIRMATION'){throw 'PREPARE_NOT_READY'}
  elseif($Action -eq 'inspect'){Write-Output $output}
  else {
   Write-Host 'Validated BEFORE/backup. The next confirmation permits ONLY migration16. No retry/reset/seed.'
   Write-Host $plan.confirmation
   $env:M16_DEPLOY_APPROVAL=Read-Host 'Type the exact confirmation above'
   & node (Join-Path $PSScriptRoot 'migration16-deploy.cjs') apply $BackupOperationId
   if($LASTEXITCODE){$operatorExit=1}
  }
 }
}catch{Write-Output '{"status":"FAILED_STOPPED","code":"M16D_INPUT_OR_LAUNCH_FAILED","automaticRetry":false}';$operatorExit=1}
finally{foreach($key in $keys){[Environment]::SetEnvironmentVariable($key,$previous[$key],'Process')};if($secure){$secure.Dispose()}}
exit $operatorExit
