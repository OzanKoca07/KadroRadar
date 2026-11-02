param(
 [Parameter(Mandatory=$true)][ValidatePattern('^[a-f0-9]{40}$')][string]$ExpectedCommit,
 [string]$ApiOrigin='https://kadroradar.onrender.com',
 [string]$WebOrigin
)
$ErrorActionPreference='Stop'
$phase='INPUT';$checks=New-Object 'Collections.Generic.List[string]'
function Stop-Smoke([string]$Code){$e=New-Object InvalidOperationException('HTTP_SMOKE_STOPPED');$e.Data['SafeCode']=$Code;throw $e}
function Require-Smoke($Condition,[string]$Code){if(-not $Condition){Stop-Smoke $Code}}
function Test-Origin([string]$Value){
 $u=$null;Require-Smoke ([Uri]::TryCreate($Value,[UriKind]::Absolute,[ref]$u)) 'ORIGIN_INVALID'
 Require-Smoke ($u.Scheme -eq 'https' -and -not $u.UserInfo -and -not $u.Query -and -not $u.Fragment -and $u.AbsolutePath -eq '/' -and $Value -ceq $u.GetLeftPart([UriPartial]::Authority) -and $u.IsDefaultPort) 'ORIGIN_INVALID'
 $ip=$null;Require-Smoke (-not $u.IsLoopback -and -not [Net.IPAddress]::TryParse($u.Host,[ref]$ip)) 'ORIGIN_INVALID'
}
function Get-Smoke([string]$Origin,[string]$Route){
 try{$r=Invoke-WebRequest -UseBasicParsing -Method Get -Uri ($Origin+$Route) -MaximumRedirection 0 -TimeoutSec 15 -ErrorAction Stop}catch{Stop-Smoke 'HTTP_REQUEST_FAILED'}
 Require-Smoke ([int]$r.StatusCode -eq 200) 'HTTP_STATUS'
 return $r
}
function Get-Json([string]$Origin,[string]$Route){$r=Get-Smoke $Origin $Route;try{$v=$r.Content|ConvertFrom-Json -ErrorAction Stop}catch{Stop-Smoke 'INVALID_JSON'};Require-Smoke ($null -ne $v) 'INVALID_JSON';return $v}
function Check-Health([string]$Origin){$v=Get-Json $Origin '/api/v1/health';Require-Smoke ($v.status -ceq 'ok' -and $v.database -ceq 'ready') 'HEALTH_NOT_READY';Require-Smoke ($v.release.commit -ceq $ExpectedCommit) 'RELEASE_SHA_MISMATCH'}
function Check-Capabilities([string]$Origin){$v=Get-Json $Origin '/api/v1/account/capabilities';foreach($key in @('selfRegistration','emailVerification','passwordReset')){Require-Smoke ($v.$key -is [bool] -and $v.$key -eq $false) 'CAPABILITY_NOT_DISABLED'};Require-Smoke ($v.passwordMinLength -eq 12 -and $v.passwordMaxLength -eq 128) 'PASSWORD_POLICY'}
try{
 Test-Origin $ApiOrigin;if(-not $WebOrigin){$WebOrigin=$ApiOrigin};Test-Origin $WebOrigin
 $phase='HEALTH';Check-Health $ApiOrigin;$checks.Add('health200_databaseReady_exactRelease')
 $phase='HISTORICAL';$a=Get-Json $ApiOrigin '/api/v1/historical/placements?limit=20&page=1';$b=Get-Json $ApiOrigin '/api/v1/historical/placements?limit=20&page=2';$again=Get-Json $ApiOrigin '/api/v1/historical/placements?limit=20&page=1'
 foreach($v in @($a,$b,$again)){Require-Smoke ($v.total -eq 8611 -and @($v.items).Count -eq 20 -and $v.filterCapabilities.maxScoreRange -eq $true) 'HISTORICAL_CONTRACT'}
 $ids=@($a.items+$b.items|ForEach-Object {Require-Smoke ($_.id -is [string] -and $_.id.Length -gt 0) 'HISTORICAL_ID';$_.id});Require-Smoke (@($ids|Select-Object -Unique).Count -eq 40) 'PAGINATION_DUPLICATE'
 Require-Smoke ((@($a.items|ForEach-Object {$_.id}) -join '|') -ceq (@($again.items|ForEach-Object {$_.id}) -join '|')) 'PAGINATION_UNSTABLE'
 $scores=Get-Json $ApiOrigin '/api/v1/historical/placements?limit=20&minScoreGte=70&maxScoreLte=90';Require-Smoke ($null -ne $scores.items -and $null -ne $scores.total -and $scores.total -ge 0 -and ($scores.total -eq 0 -or @($scores.items).Count -gt 0)) 'SCORE_CONTRACT';foreach($v in $scores.items){Require-Smoke ($null -ne $v.minScore -and $null -ne $v.maxScore) 'SCORE_FORMAT';try{$min=[Convert]::ToDouble($v.minScore,[Globalization.CultureInfo]::InvariantCulture);$max=[Convert]::ToDouble($v.maxScore,[Globalization.CultureInfo]::InvariantCulture)}catch{Stop-Smoke 'SCORE_FORMAT'};Require-Smoke ($min -ge 70 -and $max -le 90) 'SCORE_FILTER'};$checks.Add('historical8611_uniqueStablePagination_scoreFilters')
 $phase='CAPABILITIES';Check-Capabilities $ApiOrigin;$checks.Add('registrationAndRecoveryDisabled')
 $phase='ANNOUNCEMENTS';$ann=Get-Json $ApiOrigin '/api/v1/announcements?view=open';Require-Smoke ($null -ne $ann.items -and $null -ne $ann.total -and $ann.total -ge 0) 'ANNOUNCEMENTS_CONTRACT'
 $phase='NEWS';$news=Get-Json $ApiOrigin '/api/v1/announcements/news';Require-Smoke ($null -ne $news.items) 'NEWS_CONTRACT';$checks.Add('announcementsAndNews')
 $phase='LEGAL';foreach($route in @('/privacy','/delete-account')){$null=Get-Smoke $WebOrigin $route};$checks.Add('privacyAndDeleteAccount200')
 $phase='WEB_SAME_ORIGIN';Check-Health $WebOrigin;Check-Capabilities $WebOrigin
 $phase='RECOVERY_PAGE';$page=Get-Smoke $WebOrigin '/account-recovery';Require-Smoke ($page.Content -match 'src="/account-recovery.js"' -and $page.Content -match 'href="/account-recovery.css"') 'RECOVERY_ASSETS'
 Require-Smoke ($page.Headers['Content-Security-Policy'] -match "connect-src 'self'" -and $page.Headers['Content-Security-Policy'] -match "frame-ancestors 'none'" -and $page.Headers['Referrer-Policy'] -eq 'no-referrer' -and $page.Headers['Cache-Control'] -match 'no-store' -and $page.Headers['X-Frame-Options'] -eq 'DENY' -and $page.Headers['X-Content-Type-Options'] -eq 'nosniff') 'RECOVERY_HEADERS'
 $phase='RECOVERY_ASSETS';$js=Get-Smoke $WebOrigin '/account-recovery.js';$css=Get-Smoke $WebOrigin '/account-recovery.css';Require-Smoke ($js.Headers['Content-Type'] -match '(javascript|ecmascript)' -and $css.Headers['Content-Type'] -match 'text/css') 'ASSET_CONTENT_TYPE';$checks.Add('sameOriginRecoveryPageAssetsAndSecurityHeaders')
 Write-Output (@{status='PASS';release=$ExpectedCommit;historicalPlacements=8611;announcementTotal=$ann.total;newsItems=@($news.items).Count;checks=@($checks);methods=@('GET');write=$false}|ConvertTo-Json -Depth 5 -Compress);exit 0
}catch{$code='SMOKE_OPERATION_FAILED';if($_.Exception.Data['SafeCode']){$code=$_.Exception.Data['SafeCode']};Write-Output (@{status='FAIL';phase=$phase;code=$code;write=$false;methods=@('GET')}|ConvertTo-Json -Compress);exit 1}
