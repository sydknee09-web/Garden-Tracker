#!/bin/bash
# Voyager Sanctuary — one-click Android build + Firebase App Distribution
# Run from repo root: ./scripts/deploy_android.sh [release-notes]
# Prereqs: firebase login, chmod +x scripts/deploy_android.sh
# Windows: run in Git Bash or WSL, or: bash scripts/deploy_android.sh

set -e
cd "$(dirname "$0")/.."

# 1. Optional version bump (increments build number after + in pubspec.yaml)
if command -v perl &> /dev/null; then
  perl -i -pe 's/version: (.*)\+(\d+)/"version: $1+".($2+1)/e' pubspec.yaml
fi

VERSION=$(grep 'version: ' pubspec.yaml | sed 's/version: //')
echo "Starting deployment for Voyager Sanctuary v$VERSION..."

# 2. Build release APK
echo "Building APK..."
flutter build apk --release

# 3. Release notes: first argument or default
RELEASE_NOTES="${1:-Build $VERSION: RLS fixes, onboarding stagger, Return/Continue, Whetstone error handling.}"

# 4. Distribute to Firebase App Distribution
# Android app ID from firebase.json (voyager-sanctuary)
FIREBASE_APP_ID="1:826880639726:android:095964bfe47ee3945aa9ff"
echo "Uploading to Firebase App Distribution..."
firebase appdistribution:distribute build/app/outputs/flutter-apk/app-release.apk \
  --app "$FIREBASE_APP_ID" \
  --groups "testers" \
  --release-notes "$RELEASE_NOTES"

echo "Success! Version $VERSION is available for testers."
