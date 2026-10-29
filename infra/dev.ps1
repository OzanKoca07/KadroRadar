param([ValidateSet('start','stop','status')][string]$Action='start')
$ErrorActionPreference='Stop'
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$privateFolder = Join-Path $projectRoot '.local\dev-process'
# Resolve the security module from this shell, not an inherited PS7 module path.
Import-Module (Join-Path $PSHOME 'Modules\Microsoft.PowerShell.Security\Microsoft.PowerShell.Security.psd1') -ErrorAction Stop
. (Join-Path $PSScriptRoot 'private-directory.ps1')
# Status is read-only. Do not change ACLs on logs held by running services.
if ($Action -eq 'start' -and -not (Test-Path -LiteralPath (Join-Path $privateFolder 'state.json'))) {
 $null = Protect-KadroPrivateDirectory -Path $privateFolder
}
$nodeCommand = (Get-Command node.exe -ErrorAction Stop).Source
& $nodeCommand (Join-Path $PSScriptRoot 'dev.cjs') $Action
exit $LASTEXITCODE
