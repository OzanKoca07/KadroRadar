param([string]$Container='infra-db-1')
$ErrorActionPreference='Stop'
if($Container -notmatch '^[a-zA-Z0-9_-]+$'){throw 'Invalid container name'}
$root=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$destination=Join-Path $root '.local\backups'
New-Item -ItemType Directory -Force -Path $destination | Out-Null
$stamp=Get-Date -Format 'yyyyMMddHHmmss'
$restoreDatabase="kadroradar_ingestion_test_restore_$stamp"
$remoteFile="/tmp/kadroradar-$stamp.dump"
$localFile=Join-Path $destination "kadroradar-$stamp.dump"
docker exec $Container pg_dump -U kadro -d kadroradar -Fc -f $remoteFile
if($LASTEXITCODE){throw 'pg_dump failed'}
docker cp "${Container}:$remoteFile" $localFile
if($LASTEXITCODE){throw 'Backup copy failed'}
docker exec $Container createdb -U kadro $restoreDatabase
if($LASTEXITCODE){throw 'New restore database could not be created; no existing DB overwritten'}
docker exec $Container pg_restore -U kadro -d $restoreDatabase --exit-on-error $remoteFile
if($LASTEXITCODE){throw 'Restore failed'}
$sql='SELECT count(*) FROM "HistoricalPlacement" WHERE "approvedAt" IS NOT NULL;'
$count=$sql | docker exec -i $Container psql -U kadro -d $restoreDatabase -At
if($LASTEXITCODE -or [int]$count -ne 504){throw 'Restored historical count is not504'}
[pscustomobject]@{Backup=$localFile;SHA256=(Get-FileHash -LiteralPath $localFile).Hash;RestoreDatabase=$restoreDatabase;ApprovedHistorical=[int]$count;RealDatabaseWrites=0}
# Retain backup and isolated restore database for operator inspection. No cleanup/drop/migration.
