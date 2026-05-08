# Fintr Frontend Makefile
# Usage: make <command>

# Remote URL baked into capacitor.config.json when CAPACITOR_SERVER_URL is set (see ios-prod).
PRODUCTION_WEB_URL := https://www.fintr.ai

# Local Next.js dev server (pnpm dev -p 5173). iOS Simulator can use localhost.
LOCAL_CAPACITOR_SERVER_URL := http://localhost:5173

# Android Emulator host alias for the dev machine.
# (Do not use localhost on Android emulator; it points to the emulator itself.)
LOCAL_CAPACITOR_SERVER_URL_ANDROID_EMULATOR := http://10.0.2.2:5173

.PHONY: help android-dev android-live android-prod-apk android-prod-aab android-reset-emulator android-stop-emulator android-clean-build ios-app ios-dev ios-prod ios-live ios-open ios-clean ios-stop-simulator sync-android sync-ios open-android open-ios

# Default target
help:
	@echo "Available commands:"
	@echo "  Android:"
	@echo "    android-dev               - Sync and run Android (requires pnpm dev running)"
	@echo "    android-live              - Dev build with live reload (build + sync + livereload)"
	@echo "    android-prod-apk          - Production Android: export Next → cap sync → assembleRelease (no emulator)"
	@echo "    android-prod-aab          - Same as android-prod-apk but bundleRelease for Play Store"
	@echo "    android-reset-emulator    - Stop Android emulator, wipe data, and cold boot"
	@echo "    android-stop-emulator     - Stop all running Android emulators"
	@echo "    android-clean-build       - Clean Android build and gradle cache"
	@echo "    sync-android              - Sync Capacitor to Android"
	@echo "    open-android              - Open Android project in Android Studio"
	@echo ""
	@echo "  iOS:"
	@echo "    ios-app                   - Production iOS: runs scripts/mobile/build-production.sh (clean, prod URL, sync, open Xcode)"
	@echo "    ios-dev                   - Capacitor loads app from $(LOCAL_CAPACITOR_SERVER_URL) (run pnpm dev first)"
	@echo "    ios-prod                  - Load web from $(PRODUCTION_WEB_URL) in the WebView"
	@echo "    ios-live                  - iOS dev build with live reload"
	@echo "    ios-open                  - Open iOS project in Xcode"
	@echo "    ios-clean                 - Clean iOS build and derived data"
	@echo "    ios-stop-simulator        - Stop iOS Simulator"
	@echo "    sync-ios                  - Sync Capacitor to iOS"
	@echo "    open-ios                  - Open iOS project in Xcode (alias)"
	@echo ""
	@echo "  General:"
	@echo "    dev                       - Start Next.js dev server"
	@echo "    build                     - Build production Next.js app"
	@echo "    test                      - Run all tests"
	@echo "    test-watch                - Run tests in watch mode"
	@echo "    install                   - Install pnpm dependencies"

# Android Emulator Commands

android-reset-emulator:
	@echo "🔄 Resetting Android emulator..."
	@if ! command -v adb >/dev/null 2>&1; then \
		echo "❌ adb not found. Please install Android SDK and add to PATH"; \
		exit 1; \
	fi
	@if ! command -v emulator >/dev/null 2>&1; then \
		echo "❌ emulator not found. Please install Android SDK and add to PATH"; \
		exit 1; \
	fi
	@AVD_NAME=$$(emulator -list-avds | head -1); \
	if [ -z "$$AVD_NAME" ]; then \
		echo "❌ No Android Virtual Devices (AVDs) found."; \
		echo "   Create one with: Android Studio > Virtual Device Manager"; \
		exit 1; \
	fi; \
	echo "📱 Found AVD: $$AVD_NAME"
	@echo "📱 Stopping any running emulators..."
	@adb devices 2>/dev/null | grep "emulator" | awk '{print $$1}' | while read device; do \
		echo "   Stopping $$device..."; \
		adb -s $$device emu kill 2>/dev/null || true; \
	done
	@pkill -f "qemu-system" 2>/dev/null || true
	@sleep 3
	@echo "🧹 Wiping emulator data (cold boot)..."
	@AVD_NAME=$$(emulator -list-avds | head -1); \
	emulator -avd "$$AVD_NAME" -wipe-data -no-boot-anim &
	@echo "⏳ Waiting for emulator to boot (this may take 30-60 seconds)..."
	@sleep 15
	@for i in 1 2 3 4 5 6 7 8 9 10; do \
		if adb shell getprop sys.boot_completed 2>/dev/null | grep -q "1"; then \
			echo "✅ Emulator is ready!"; \
			exit 0; \
		fi; \
		echo "   Still booting... ($$i/10)"; \
		sleep 5; \
	done
	@echo "⚠️  Emulator may still be booting. Check Android Studio."

# Android dev build (local development version - sync, run)
android-dev:
	@echo "🚀 Starting Android dev build..."
	@echo ""
	@echo "📋 This will:"
	@echo "   1. Sync Capacitor to Android (cap sync android)"
	@echo "   2. Run on Android device/emulator (cap run android)"
	@echo ""
	@echo "💡 CAPACITOR_SERVER_URL is forced to $(LOCAL_CAPACITOR_SERVER_URL_ANDROID_EMULATOR)"
	@echo "💡 Make sure pnpm dev is running in another terminal!"
	@echo "💡 Tip: For live reload development, use: make android-live"
	@echo ""
	@sleep 2
	@echo "🔄 Step 1/2: Syncing Capacitor to Android..."
	@mkdir -p android/app/src/main/assets
	@CAPACITOR_SERVER_URL=$(LOCAL_CAPACITOR_SERVER_URL_ANDROID_EMULATOR) pnpm cap sync android || (echo "❌ Capacitor sync failed"; exit 1)
	@echo "✅ Capacitor sync complete"
	@echo ""
	@echo "📱 Step 2/2: Running on Android..."
	@CAPACITOR_SERVER_URL=$(LOCAL_CAPACITOR_SERVER_URL_ANDROID_EMULATOR) pnpm cap run android

# Live reload development (build once, then live reload)
android-live:
	@echo "🚀 Starting Android with live reload..."
	@echo ""
	@echo "📋 This will:"
	@echo "   1. Build Next.js app"
	@echo "   2. Sync Capacitor"
	@echo "   3. Start dev server with live reload"
	@echo ""
	@echo "💡 Server URLs:"
	@echo "   - Android Emulator: http://10.0.2.2:5173"
	@echo "   - Physical Device:  Set CAPACITOR_SERVER_URL to your computer's IP"
	@echo "      (e.g., export CAPACITOR_SERVER_URL=http://192.168.1.100:5173)"
	@echo ""
	@sleep 2
	@echo "🔨 Building Next.js app..."
	@pnpm build || (echo "❌ Build failed"; exit 1)
	@echo "🔄 Syncing Capacitor..."
	@mkdir -p android/app/src/main/assets
	@pnpm cap sync android
	@echo "📱 Starting Android with livereload..."
	@pnpm cap run android --livereload --external

# Production Android: same flow as scripts/mobile/build-production-android.sh without emulator
android-prod-apk:
	@SKIP_EMULATOR=1 ANDROID_ARTIFACT=apk ./scripts/mobile/build-production-android.sh

android-prod-aab:
	@SKIP_EMULATOR=1 ANDROID_ARTIFACT=aab ./scripts/mobile/build-production-android.sh

# iOS Commands

ios-app:
	@./scripts/mobile/build-production.sh

ios-dev:
	@echo "🚀 Starting iOS dev (WebView → $(LOCAL_CAPACITOR_SERVER_URL))..."
	@echo ""
	@echo "📋 This will:"
	@echo "   1. Build Next.js app (pnpm build) — sync still needs webDir/out"
	@echo "   2. Sync Capacitor to iOS with CAPACITOR_SERVER_URL=$(LOCAL_CAPACITOR_SERVER_URL)"
	@echo "   3. Run on iOS simulator or device (cap run ios)"
	@echo ""
	@echo "⚠️  Start the dev server first: pnpm dev  (listens on port 5173)"
	@echo "💡 Physical device: use your Mac LAN IP instead of localhost, then cap sync/run with that URL"
	@echo "💡 Tip: For live reload flags, use: make ios-live"
	@echo "💡 Tip: To load $(PRODUCTION_WEB_URL) in the WebView, use: make ios-prod"
	@echo "💡 Tip: To open in Xcode, use: make ios-open"
	@echo ""
	@sleep 2
	@echo "🔨 Step 1/3: Building Next.js app..."
	@pnpm build || (echo "❌ Build failed. Fix errors and try again."; exit 1)
	@echo "✅ Next.js build complete"
	@echo ""
	@echo "🔄 Step 2/3: Syncing Capacitor to iOS..."
	@CAPACITOR_SERVER_URL=$(LOCAL_CAPACITOR_SERVER_URL) pnpm cap sync ios || (echo "❌ Capacitor sync failed"; exit 1)
	@if ! grep -qF "localhost" ios/App/App/capacitor.config.json 2>/dev/null; then \
		echo "❌ Expected $(LOCAL_CAPACITOR_SERVER_URL) in ios/App/App/capacitor.config.json"; \
		exit 1; \
	fi
	@echo "✅ Capacitor sync complete (native config points at $(LOCAL_CAPACITOR_SERVER_URL))"
	@echo ""
	@echo "📱 Step 3/3: Running on iOS..."
	@echo "⏳ Select a simulator from the list or connect a device"
	@CAPACITOR_SERVER_URL=$(LOCAL_CAPACITOR_SERVER_URL) pnpm cap run ios

ios-prod:
	@echo "🚀 Starting iOS build (WebView loads $(PRODUCTION_WEB_URL))..."
	@echo ""
	@echo "📋 This will:"
	@echo "   1. Build Next.js (pnpm build) with NEXT_PUBLIC_APP_BASE_URL=$(PRODUCTION_WEB_URL)"
	@echo "   2. Sync Capacitor with CAPACITOR_SERVER_URL=$(PRODUCTION_WEB_URL)"
	@echo "   3. Run on iOS simulator or device"
	@echo ""
	@echo "💡 This matches the production Capacitor setup (remote website, not bundled out/)."
	@echo ""
	@sleep 2
	@echo "🔨 Step 1/3: Building Next.js app..."
	@NEXT_PUBLIC_APP_BASE_URL=$(PRODUCTION_WEB_URL) pnpm build || (echo "❌ Build failed. Fix errors and try again."; exit 1)
	@echo "✅ Next.js build complete"
	@echo ""
	@echo "🔄 Step 2/3: Syncing Capacitor to iOS..."
	@CAPACITOR_SERVER_URL=$(PRODUCTION_WEB_URL) pnpm cap sync ios || (echo "❌ Capacitor sync failed"; exit 1)
	@if ! grep -qF "$(PRODUCTION_WEB_URL)" ios/App/App/capacitor.config.json 2>/dev/null; then \
		echo "❌ Expected $(PRODUCTION_WEB_URL) in ios/App/App/capacitor.config.json"; \
		exit 1; \
	fi
	@echo "✅ Capacitor sync complete"
	@echo ""
	@echo "📱 Step 3/3: Running on iOS..."
	@CAPACITOR_SERVER_URL=$(PRODUCTION_WEB_URL) pnpm cap run ios

ios-live:
	@echo "🚀 Starting iOS with live reload..."
	@echo ""
	@echo "📋 This will:"
	@echo "   1. Build Next.js app"
	@echo "   2. Sync Capacitor to iOS"
	@echo "   3. Start dev server with live reload"
	@echo ""
	@echo "💡 Server URLs:"
	@echo "   - iOS Simulator:     http://localhost:5173"
	@echo "   - Physical Device:   Set CAPACITOR_SERVER_URL to your Mac's IP"
	@echo "      (e.g., export CAPACITOR_SERVER_URL=http://192.168.1.100:5173)"
	@echo ""
	@echo "📝 To find your Mac's IP: ifconfig | grep 'inet '" 
	@echo ""
	@sleep 2
	@echo "🔨 Building Next.js app..."
	@pnpm build || (echo "❌ Build failed"; exit 1)
	@echo "🔄 Syncing Capacitor to iOS..."
	@CAPACITOR_SERVER_URL=$(LOCAL_CAPACITOR_SERVER_URL) pnpm cap sync ios
	@echo "📱 Starting iOS with livereload..."
	@CAPACITOR_SERVER_URL=$(LOCAL_CAPACITOR_SERVER_URL) pnpm cap run ios --livereload --external

ios-open:
	@echo "🚀 Opening iOS project in Xcode..."
	@if [ ! -d "ios/App.xcodeproj" ] && [ ! -d "ios/App.xcworkspace" ]; then \
		echo "❌ iOS project not found. Run 'make ios-dev' or 'pnpm cap sync ios' first"; \
		exit 1; \
	fi
	@echo "📱 Opening Xcode..."
	@pnpm cap open ios

ios-clean:
	@echo "🧹 Cleaning iOS build..."
	@if [ -d "ios" ]; then \
		echo "   Cleaning derived data and build folders..."; \
		rm -rf ~/Library/Developer/Xcode/DerivedData/App-* 2>/dev/null || true; \
		rm -rf ios/build 2>/dev/null || true; \
		rm -rf ios/App/build 2>/dev/null || true; \
		echo "✅ iOS build cleaned"; \
	else \
		echo "❌ iOS directory not found. Run 'pnpm cap sync ios' first"; \
		exit 1; \
	fi

ios-stop-simulator:
	@echo "🛑 Stopping iOS Simulator..."
	@xcrun simctl shutdown all 2>/dev/null && echo "✅ iOS simulators stopped" || echo "   No iOS simulators running"

android-stop-emulator:
	@echo "🛑 Stopping Android emulators..."
	@RUNNING_EMULATORS=$$(adb devices 2>/dev/null | grep "emulator" | awk '{print $$1}'); \
	if [ -n "$$RUNNING_EMULATORS" ]; then \
		echo "   Found running emulators: $$RUNNING_EMULATORS"; \
		echo $$RUNNING_EMULATORS | tr ' ' '\n' | while read device; do \
			echo "   Stopping $$device..."; \
			adb -s $$device emu kill 2>/dev/null || true; \
		done; \
	else \
		echo "   No running emulators found"; \
	fi
	@echo "   Checking for orphaned emulator processes..."
	@pkill -f "qemu-system" 2>/dev/null && echo "   Killed orphaned qemu processes" || true
	@echo "✅ Emulators stopped"

android-clean-build:
	@echo "🧹 Cleaning Android build..."
	@if [ ! -f "android/gradlew" ]; then \
		echo "❌ Android gradlew not found. Run 'pnpm cap sync android' first"; \
		exit 1; \
	fi
	@cd android && ./gradlew clean 2>&1 | tail -5
	@rm -rf android/app/build
	@rm -rf android/.gradle
	@echo "✅ Android build cleaned"

# General Development Commands

dev:
	@pnpm dev

build:
	@pnpm build

test:
	@pnpm test --run

test-watch:
	@pnpm test

# Install dependencies
install:
	@pnpm install

# Sync Capacitor (after web build)
sync-android:
	@mkdir -p android/app/src/main/assets
	@pnpm cap sync android

sync-ios:
	@pnpm cap sync ios

# Open projects in native IDEs
open-android:
	@pnpm cap open android

open-ios:
	@pnpm cap open ios
