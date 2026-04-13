# Voyager Sanctuary — one-click Android build + Firebase App Distribution
# Run from repo root: .\scripts\deploy_android.ps1 ["release notes"]
# Prereqs: firebase login (firebase CLI in PATH)
#
# Usage: .\scripts\deploy_android.ps1
#        .\scripts\deploy_android.ps1 "Display name in Settings; First Blockage verified."

param(
    [string]$ReleaseNotes = ""
)

$ErrorActionPreference = "Stop"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent $scriptDir
Push-Location $projectRoot

try {
    $pubspecPath = Join-Path $projectRoot "pubspec.yaml"
    $pubspec = Get-Content $pubspecPath -Raw

    # Bump build number (after +)
    if ($pubspec -match "version:\s*[\d.]+\+(\d+)") {
        $buildNum = [int]$Matches[1] + 1
        $pubspec = $pubspec -replace "(version:\s*[\d.]+\+)(\d+)", "`${1}$buildNum"
        Set-Content -Path $pubspecPath -Value $pubspec.TrimEnd() -NoNewline
    }

    $versionLine = Get-Content $pubspecPath | Select-String -Pattern "^version:\s*"
    $version = ($versionLine -replace "version:\s*", "").Trim()
    Write-Host "Starting deployment for Voyager Sanctuary v$version..." -ForegroundColor Cyan

    Write-Host "Building APK..." -ForegroundColor Cyan
    flutter build apk --release
    if ($LASTEXITCODE -ne 0) { throw "flutter build apk failed" }

    if ([string]::IsNullOrWhiteSpace($ReleaseNotes)) {
        $ReleaseNotes = "Build $version : ready for testers."
    }

    $apkPath = Join-Path $projectRoot "build\app\outputs\flutter-apk\app-release.apk"
    if (-not (Test-Path $apkPath)) {
        throw "APK not found at $apkPath"
    }

    $FIREBASE_APP_ID = "1:826880639726:android:095964bfe47ee3945aa9ff"
    Write-Host "Uploading to Firebase App Distribution..." -ForegroundColor Cyan
    firebase appdistribution:distribute $apkPath `
        --app $FIREBASE_APP_ID `
        --groups "testers" `
        --release-notes $ReleaseNotes

    if ($LASTEXITCODE -ne 0) { throw "firebase appdistribution failed" }
    Write-Host "Success! Version $version is available for testers." -ForegroundColor Green
}
finally {
    Pop-Location
}
