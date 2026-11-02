$ErrorActionPreference='Stop'
$global:SmokeMode='ok';$global:SmokeCalls=0;$commit='a'*40
function global:Invoke-WebRequest {
 param([switch]$UseBasicParsing,[string]$Method,[string]$Uri,[int]$MaximumRedirection,[int]$TimeoutSec,[string]$ErrorAction)
 if($Method -ne 'Get' -or $MaximumRedirection -ne 0 -or $TimeoutSec -ne 15){throw 'UNSAFE_REQUEST'};$global:SmokeCalls++
 $u=[Uri]$Uri;$route=$u.AbsolutePath;$headers=@{'Content-Security-Policy'="default-src 'none'; connect-src 'self'; frame-ancestors 'none'";'Referrer-Policy'='no-referrer';'Cache-Control'='no-store';'X-Frame-Options'='DENY';'X-Content-Type-Options'='nosniff';'Content-Type'='application/json'}
 $data=$null;$status=200;$content=''
 if($global:SmokeMode -eq 'network'){throw 'SYNTHETIC_PRIVATE_EXCEPTION'}
 switch($route){
  '/api/v1/health' {$data=@{status='ok';database='ready';release=@{commit=('a'*40)}};if($global:SmokeMode -eq 'sha'){$data.release.commit='b'*40};if($global:SmokeMode -eq 'missingSha'){$data.Remove('release')};if($global:SmokeMode -eq 'http503'){$status=503};if($global:SmokeMode -eq 'json'){$content='not json'}}
  '/api/v1/account/capabilities' {$data=@{selfRegistration=$false;emailVerification=$false;passwordReset=$false;passwordMinLength=12;passwordMaxLength=128};if($global:SmokeMode -eq 'registration'){$data.selfRegistration=$true};if($global:SmokeMode -eq 'recovery'){$data.passwordReset=$true}}
  '/api/v1/historical/placements' {$offset=0;if($u.Query -match 'page=2'){$offset=20};if($global:SmokeMode -eq 'duplicate'){$offset=0};$items=@(1..20|ForEach-Object {@{id=('fixture-'+($_+$offset));minScore='70.00000';maxScore='90.00000'}});$data=@{items=$items;total=8611;filterCapabilities=@{maxScoreRange=$true}};if($global:SmokeMode -eq 'count'){$data.total=8610};if($global:SmokeMode -eq 'score'){$data.items[0].maxScore='99.00000'};if($global:SmokeMode -eq 'scoreContract' -and $u.Query -match 'minScoreGte'){$data=@{unexpected=$true}}}
  '/api/v1/announcements' {$data=@{items=@();total=0}}
  '/api/v1/announcements/news' {$data=@{items=@()}}
  '/account-recovery' {$content='<script src="/account-recovery.js"></script><link href="/account-recovery.css">';if($global:SmokeMode -eq 'headers'){$headers.Remove('Content-Security-Policy')}}
  '/account-recovery.js' {$content='synthetic';$headers['Content-Type']='application/javascript';if($global:SmokeMode -eq 'asset404'){$status=404}}
  '/account-recovery.css' {$content='synthetic';$headers['Content-Type']='text/css'}
  '/privacy' {$content='synthetic'}
  '/delete-account' {$content='synthetic'}
  default {throw 'UNEXPECTED_ROUTE'}
 }
 if($data -and -not $content){$content=$data|ConvertTo-Json -Depth 8 -Compress};return [pscustomobject]@{StatusCode=$status;Content=$content;Headers=$headers}
}
try{
 $tests=0;foreach($mode in @('ok','sha','missingSha','http503','json','registration','recovery','duplicate','count','score','scoreContract','headers','asset404','network')){
  $global:SmokeMode=$mode;$output=& (Join-Path $PSScriptRoot 'release-http-smoke.ps1') -ExpectedCommit $commit -ApiOrigin 'https://api.example.test' -WebOrigin 'https://web.example.test';$result=$output|ConvertFrom-Json
  if($output -match 'SYNTHETIC_PRIVATE_EXCEPTION'){throw 'RAW_ERROR_LEAK'}
  if($mode -eq 'ok'){if($result.status -ne 'PASS' -or $LASTEXITCODE -ne 0){throw 'PASS_CASE_FAILED'}}else{if($result.status -ne 'FAIL' -or $LASTEXITCODE -ne 1){throw 'FAILURE_HIDDEN'}};$tests++
 }
 $before=$global:SmokeCalls;$out=& (Join-Path $PSScriptRoot 'release-http-smoke.ps1') -ExpectedCommit $commit -ApiOrigin 'https://user:placeholder@api.example.test';if(($out|ConvertFrom-Json).status -ne 'FAIL' -or $global:SmokeCalls -ne $before){throw 'ORIGIN_GUARD'};$tests++
 Write-Output (@{status='PASS';test='release-http-smoke';checks=$tests;powerShell=$PSVersionTable.PSVersion.ToString();realRequests=0}|ConvertTo-Json -Compress)
}finally{Remove-Item Function:\Invoke-WebRequest -ErrorAction SilentlyContinue}
