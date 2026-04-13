# Build release APK and push to Firebase App Distribution.
# Prereqs: firebase login, flutter in PATH.
#
# Usage:
#   .\deploy.ps1 [-ReleaseNotes "your notes"]
#   .\deploy.ps1 -DemoMode -ReleaseNotes "v0.1.2+19 demo: no login"
#   .\deploy.ps1 -Clean -DemoMode   # flutter clean first
#   .\deploy.ps1 -SkipVersionBump   # redeploy without bumping pubspec +build

param(
    [string]$ReleaseNotes = "Voyager Sanctuary release",
    [switch]$DemoMode,
    [switch]$Clean,
    [switch]$SkipVersionBump
)

$ErrorActionPreference = "Stop"
$FirebaseAppId = "1:826880639726:android:095964bfe47ee3945aa9ff"
$ApkPath = "build\app\outputs\flutter-apk\app-release.apk"

$pubspecPath = Join-Path $PSScriptRoot "pubspec.yaml"
if (-not $SkipVersionBump) {
    $lines = Get-Content -LiteralPath $pubspecPath
    $bumped = $false
    $newLines = foreach ($line in $lines) {
        if ($line -match '^version:\s*([\d.]+)\+(\d+)\s*$') {
            $next = [int]$Matches[2] + 1
            $bumped = $true
            "version: $($Matches[1])+$next"
        } else {
            $line
        }
    }
    if (-not $bumped) {
        Write-Error "Could not find version: x.y.z+NN in pubspec.yaml"
        exit 1
    }
    $newLines | Set-Content -LiteralPath $pubspecPath -Encoding utf8
    Write-Host "Bumped pubspec build number (version line updated)."
}

if ($Clean) {
    Write-Host "Running flutter clean..."
    flutter clean
}

if ($DemoMode) {
    Write-Host "Building Voyager Sanctuary (release APK) with DEMO - SKIP_AUTH=true..."
    flutter build apk --release --dart-define=SKIP_AUTH=true
} else {
    Write-Host "Building Voyager Sanctuary (release APK)..."
    flutter build apk --release
}

if (-not (Test-Path $ApkPath)) {
    Write-Error "APK not found at $ApkPath"
    exit 1
}

Write-Host "Pushing to Firebase App Distribution..."
firebase appdistribution:distribute $ApkPath `
    --app $FirebaseAppId `
    --release-notes $ReleaseNotes `
    --groups "testers"

Write-Host 'Done. Check Firebase Console - App Distribution for the new release.'
