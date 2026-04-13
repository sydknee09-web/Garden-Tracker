# Cursor `stop` hook: deploy to Firebase App Distribution when lib / pubspec / android changed
# since the last successful auto-deploy fingerprint (avoids duplicate builds).
# Requires: flutter and firebase on PATH, `firebase login` already done on this machine.

$ErrorActionPreference = 'Stop'

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..' '..')).Path
$FingerprintPath = Join-Path $RepoRoot '.cursor/last-auto-deploy-fingerprint.txt'

function Get-FlutterDeployFingerprint {
    Set-Location $RepoRoot
    $out = git status --porcelain=v1 -- lib pubspec.yaml android 2>$null
    if ([string]::IsNullOrWhiteSpace($out)) { return $null }

    $entries = New-Object System.Collections.Generic.List[string]
    foreach ($line in ($out -split "`r?`n")) {
        $t = $line.Trim()
        if ($t.Length -lt 4) { continue }
        $rel = $t.Substring(3).Trim().Trim('"')
        $rel = $rel -replace '\\', '/'
        if ($rel -notmatch '^(lib/|pubspec\.yaml|android/)') { continue }
        $full = Join-Path $RepoRoot $rel
        if (Test-Path -LiteralPath $full -PathType Leaf) {
            $h = (Get-FileHash -LiteralPath $full -Algorithm SHA256).Hash
            $entries.Add("$rel|$h")
        }
        elseif (Test-Path -LiteralPath $full -PathType Container) {
            $entries.Add("$rel|DIR")
        }
        else {
            $entries.Add("$rel|GONE")
        }
    }
    if ($entries.Count -eq 0) { return $null }

    $entries.Sort()
    $raw = [string]::Join("`n", $entries)
    $bytes = [Text.Encoding]::UTF8.GetBytes($raw)
    $sha = [System.Security.Cryptography.SHA256]::Create().ComputeHash($bytes)
    return ([BitConverter]::ToString($sha)) -replace '-', ''
}

try {
    Set-Location $RepoRoot
    $preFp = Get-FlutterDeployFingerprint
    if ($null -eq $preFp) { exit 0 }

    $prev = $null
    if (Test-Path -LiteralPath $FingerprintPath) {
        $prev = (Get-Content -LiteralPath $FingerprintPath -Raw).Trim()
    }
    if ($preFp -eq $prev) { exit 0 }

    $deploy = Join-Path $RepoRoot 'deploy.ps1'
    if (-not (Test-Path -LiteralPath $deploy)) { exit 0 }

    & $deploy -ReleaseNotes 'Auto: Cursor stop hook (Flutter/Android changes)'

    $postFp = Get-FlutterDeployFingerprint
    if ($null -ne $postFp) {
        Set-Content -LiteralPath $FingerprintPath -Value $postFp -NoNewline -Encoding utf8
    }
}
catch {
    # Fail open: never block Cursor on deploy errors
    exit 0
}

exit 0
