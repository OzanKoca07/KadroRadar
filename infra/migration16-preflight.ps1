param([ValidateSet('before','after')][string]$Phase='before')
$ErrorActionPreference='Stop'
# Read-only DB inspection. No secret file or journal; never echo connection values.
$names=@('OSYM_DATABASE_URL','OSYM_DATABASE_HOST','OSYM_DATABASE_NAME','OSYM_DATABASE_PORT')
$previous=@{}
foreach($name in $names){$previous[$name]=[Environment]::GetEnvironmentVariable($name,'Process')}
$operatorExitCode=0
try {
 # A PS7 parent may export PSModulePath to PS5.1. Use this shell's security
 # cmdlets instead of autoloading an incompatible ConvertTo-SecureString module.
 Import-Module (Join-Path $PSHOME 'Modules\Microsoft.PowerShell.Security\Microsoft.PowerShell.Security.psd1') -ErrorAction Stop
 $env:OSYM_DATABASE_HOST=(Read-Host 'Exact Render external hostname').Trim()
 $env:OSYM_DATABASE_NAME=(Read-Host 'Exact Render database name').Trim()
 $env:OSYM_DATABASE_PORT='5432'
 $secure=Read-Host 'Render URL (hidden; never share in chat)' -AsSecureString
 $pointer=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
 try {$env:OSYM_DATABASE_URL=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)} finally {[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)}
 & node (Join-Path $PSScriptRoot 'migration16-preflight.cjs') $Phase
 if($LASTEXITCODE){$operatorExitCode=1}
} catch {
 Write-Output '{"status":"FAIL","readOnly":true,"write":false,"phase":"INPUT","code":"UNKNOWN_OPERATION_FAILURE","evidence":"POWERSHELL_INPUT_OR_LAUNCH"}'
 $operatorExitCode=1
} finally {
 foreach($name in $names){[Environment]::SetEnvironmentVariable($name,$previous[$name],'Process')}
 if($secure){$secure.Dispose()}
}
exit $operatorExitCode
