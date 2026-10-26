$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot 'private-directory.ps1')
$testRoot=Join-Path ([IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))) ('.local\acl-test-'+[guid]::NewGuid().ToString('N'))
try {
 $tokens=$null;$parseErrors=$null
 $null=[Management.Automation.Language.Parser]::ParseFile((Join-Path $PSScriptRoot 'osym-production.ps1'),[ref]$tokens,[ref]$parseErrors)
 if($parseErrors.Count){throw 'OPERATOR_SCRIPT_SYNTAX_ERROR'}
 New-Item -ItemType Directory -Path (Join-Path $testRoot 'nested') -Force | Out-Null
 [IO.File]::WriteAllText((Join-Path $testRoot 'nested\test.txt'),'NON_SECRET_TEST_DATA')
 $null=Protect-KadroPrivateDirectory $testRoot
 $null=Protect-KadroPrivateDirectory $testRoot
 if([IO.File]::ReadAllText((Join-Path $testRoot 'nested\test.txt')) -ne 'NON_SECRET_TEST_DATA'){throw 'CONTENT_CHANGED'}
 [IO.File]::WriteAllText((Join-Path $testRoot 'new.txt'),'NON_SECRET_TEST_DATA')
 $newRules=@((Get-Acl -LiteralPath (Join-Path $testRoot 'new.txt')).GetAccessRules($true,$true,[Security.Principal.SecurityIdentifier]))
 if($newRules.Count -ne 3){throw 'NEW_FILE_INHERITANCE_UNSAFE'}
 $bad=Join-Path $testRoot 'not-a-directory';[IO.File]::WriteAllText($bad,'x')
 $failed=$false;try{$null=Protect-KadroPrivateDirectory $bad}catch{$failed=$true;if($_.Exception.Message -notlike 'PRIVATE_DIRECTORY_ACL_FAILED:*'){throw}}
 if(-not $failed){throw 'FAIL_CLOSED_REQUIRED'}
 Write-Output ('PASS: private DACL, existing children, inherited new files, idempotence, fail-closed; PowerShell '+$PSVersionTable.PSVersion+'; no database connection')
} finally {
 $resolved=[IO.Path]::GetFullPath($testRoot)
 $expected=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\.local'))+[IO.Path]::DirectorySeparatorChar
 if(-not $resolved.StartsWith($expected,[StringComparison]::OrdinalIgnoreCase) -or [IO.Path]::GetFileName($resolved) -notmatch '^acl-test-[a-f0-9]{32}$'){throw 'UNSAFE_CLEANUP'}
 if(Test-Path -LiteralPath $resolved){Remove-Item -LiteralPath $resolved -Recurse -Force}
}
