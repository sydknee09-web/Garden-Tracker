#!/usr/bin/env bash
# Build release APK and push to Firebase App Distribution.
# Prereqs: firebase login, flutter in PATH.
# Usage: ./deploy.sh [release-notes]

set -e
FIREBASE_APP_ID="1:826880639726:android:095964bfe47ee3945aa9ff"
APK_PATH="build/app/outputs/flutter-apk/app-release.apk"
RELEASE_NOTES="${1:-Voyager Sanctuary release}"

echo "Building Voyager Sanctuary (release APK)..."
flutter build apk --release

if [[ ! -f "$APK_PATH" ]]; then
  echo "Error: APK not found at $APK_PATH"
  exit 1
fi

echo "Pushing to Firebase App Distribution..."
firebase appdistribution:distribute "$APK_PATH" \
  --app "$FIREBASE_APP_ID" \
  --release-notes "$RELEASE_NOTES" \
  --groups "testers"

echo "Done. Check Firebase Console > App Distribution for the new release."
