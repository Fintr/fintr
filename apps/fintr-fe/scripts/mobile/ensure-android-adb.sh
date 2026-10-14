#!/usr/bin/env bash
# Use the Android SDK platform-tools adb (same binary Capacitor/native-run uses).
# Usage: . ./scripts/mobile/ensure-android-adb.sh

ensure_android_adb() {
  local sdk="${ANDROID_SDK_ROOT:-${ANDROID_HOME:-${HOME}/Library/Android/sdk}}"
  local platform_tools="${sdk}/platform-tools"
  local sdk_adb="${platform_tools}/adb"

  if [ ! -x "$sdk_adb" ]; then
    echo "ERROR: adb not found at ${sdk_adb}"
    echo "  Install Android SDK platform-tools or set ANDROID_SDK_ROOT."
    exit 1
  fi

  export ANDROID_SDK_ROOT="$sdk"
  export ANDROID_HOME="$sdk"
  export PATH="${platform_tools}:${PATH}"

  local brew_adb=""
  if command -v brew >/dev/null 2>&1; then
    brew_adb="$(brew --prefix android-platform-tools 2>/dev/null)/bin/adb"
  fi
  if [ -n "$brew_adb" ] && [ -x "$brew_adb" ] && [ "$brew_adb" != "$sdk_adb" ]; then
    if command -v adb >/dev/null 2>&1 && [ "$(command -v adb)" != "$sdk_adb" ]; then
      echo "Using SDK adb at ${sdk_adb} (not Homebrew adb) to avoid ADB daemon conflicts."
      echo ""
    fi
  fi

  if ! "$sdk_adb" start-server >/dev/null 2>&1; then
    echo "ADB start-server failed; resetting stuck adb processes..."
    pkill -9 adb 2>/dev/null || true
    sleep 1
    "$sdk_adb" start-server || {
      echo "ERROR: Could not start adb. Try: make android-adb-restart"
      exit 1
    }
  fi

  "$sdk_adb" wait-for-device

  local boot=""
  local attempt=0
  while [ "$attempt" -lt 30 ]; do
    boot="$("$sdk_adb" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')"
    if [ "$boot" = "1" ]; then
      return 0
    fi
    attempt=$((attempt + 1))
    sleep 2
  done

  echo "WARNING: Emulator may still be booting (sys.boot_completed != 1)."
}

ensure_android_adb
