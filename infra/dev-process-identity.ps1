param([Parameter(Mandatory=$true)][string]$ProjectRoot, [Parameter(Mandatory=$true)][string]$ProcessIds)
$ErrorActionPreference = 'Stop'
try {
    $ids = @($ProcessIds.Split(',') | ForEach-Object { [int]$_ })
    $scripts = @{
        owner = 'infra\dev.cjs'
        api = 'apps\api\dist\main.js'
        admin = 'node_modules\vite\bin\vite.js'
        metro = 'node_modules\expo\bin\cli'
    }
    $records = @(foreach ($processId in $ids) {
        $p = Get-CimInstance Win32_Process -Filter "ProcessId=$processId"
        if ($null -eq $p) { continue }
        $kind = 'OTHER'
        if ($p.Name -eq 'node.exe') {
            foreach ($entry in $scripts.GetEnumerator()) {
                $target = [IO.Path]::GetFullPath((Join-Path $ProjectRoot $entry.Value))
                # Inspect internally; never return command lines or environment values.
                $escaped = [regex]::Escape($target).Replace('\\','[\\/]')
                $scriptToken = '"' + $escaped + '"'
                if ($target -notmatch '\s') { $scriptToken = '(?:' + $scriptToken + '|' + $escaped + ')' }
                # The actual first Node argument must be this script, not text
                # embedded in -e or an unrelated project's additional argument.
                $pattern = '(?i)^\s*(?:"[^"]+"|[^\s"]+)\s+' + $scriptToken + '(?=\s|$)'
                if ($entry.Key -eq 'owner') { $pattern += '(?:\s+start)?\s*$' }
                if ($p.CommandLine -match $pattern) { $kind = $entry.Key; break }
            }
        }
        [pscustomobject]@{ pid=[int]$p.ProcessId; parent=[int]$p.ParentProcessId; created=$p.CreationDate.ToUniversalTime().ToString('o'); kind=$kind }
    })
    ConvertTo-Json -InputObject $records -Compress
} catch {
    Write-Output '{"error":"DEV_IDENTITY_PROBE_FAILED"}'
    exit 1
}
