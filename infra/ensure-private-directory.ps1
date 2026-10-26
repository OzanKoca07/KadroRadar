param([Parameter(Mandatory=$true)][string]$Path)
$ErrorActionPreference='Stop'
try {
 . (Join-Path $PSScriptRoot 'private-directory.ps1')
 $null=Protect-KadroPrivateDirectory -Path $Path
} catch {Write-Error 'PRIVATE_DIRECTORY_ACL_FAILED: operation stopped before database access.';exit 1}
