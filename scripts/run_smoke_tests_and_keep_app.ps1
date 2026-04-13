# Run synthetic user smoke tests, then reinstall the app so it stays on the device for manual testing.
# Flutter uninstalls the app after integration tests; this script restores it.
# Retries up to 3 times on DDS/Connection Closed errors.
#
# Usage: .\scripts\run_smoke_tests_and_keep_app.ps1 [-DeviceId R5CW3057XJP]
# Default device: R5CW3057XJP (Samsung). Override with -DeviceId.

param(
    [string]$DeviceId = "R5CW3057XJP"
)

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Push-Location $projectRoot

try {
$maxRetries = 3
$testExitCode = 1

for ($attempt = 1; $attempt -le $maxRetries; $attempt++) {
    Write-Host "Running smoke tests on device $DeviceId (attempt $attempt/$maxRetries)..." -ForegroundColor Cyan
    $output = flutter test integration_test/synthetic_users/synthetic_user_test.dart -d $DeviceId --timeout 5m --dart-define=SKIP_AUTH=true 2>&1
    $testExitCode = $LASTEXITCODE

    $outputStr = $output | Out-String
    if ($testExitCode -eq 0) {
        break
    }
    $isRetryable = $outputStr -match "Connection closed|DDS|Dart Development Service|Failed to start"
    if (-not $isRetryable -or $attempt -eq $maxRetries) {
        break
    }
    Write-Host "DDS/Connection error detected. Retrying in 5s..." -ForegroundColor Yellow
    Start-Sleep -Seconds 5
}

Write-Host ""
Write-Host "Pulling JSON logs from device..." -ForegroundColor Cyan
$outputDir = Join-Path $projectRoot "integration_test\synthetic_users\output"
if (-not (Test-Path $outputDir)) {
    New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
}
$adbPath = Get-Command adb -ErrorAction SilentlyContinue
if ($adbPath) {
    $pullResult = adb -s $DeviceId pull /sdcard/Download/voyager_sanctuary_logs $outputDir 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Logs pulled to $outputDir" -ForegroundColor Green
    } else {
        Write-Host "Log pull skipped (adb or path not available). Logs may be in device temp." -ForegroundColor Yellow
    }
} else {
    Write-Host "adb not in PATH; skipping log pull. Add Android SDK platform-tools to PATH for automatic log retrieval." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Reinstalling app for manual testing..." -ForegroundColor Cyan
flutter install -d $DeviceId --debug
$installExitCode = $LASTEXITCODE

if ($testExitCode -ne 0) {
    Write-Host "Tests exited with code $testExitCode (some may have failed)." -ForegroundColor Yellow
}
if ($installExitCode -eq 0) {
    Write-Host "App installed. It will remain on your device until you uninstall or run tests again." -ForegroundColor Green
}
exit $testExitCode
} finally {
    Pop-Location
}
