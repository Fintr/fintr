#!/usr/bin/env bash
# Point JAVA_HOME at a JDK that Gradle 8.13 can run on.
# Usage: source scripts/mobile/ensure-gradle-jdk.sh

# Gradle 8.13 cannot run on JDK 25+ (class file major version 69+).
# This Android project compiles as Java 21.
java_spec_version() {
  "$1" -version 2>&1 | awk -F'[".]' '/version/ { print ($2 == "1" ? $3 : $2); exit }'
}

ensure_gradle_jdk() {
  local current_bin="java"
  if [ -n "${JAVA_HOME:-}" ] && [ -x "${JAVA_HOME}/bin/java" ]; then
    current_bin="${JAVA_HOME}/bin/java"
  fi

  local major
  major="$(java_spec_version "$current_bin" || true)"
  if [ -n "$major" ] && [ "$major" -ge 17 ] && [ "$major" -le 21 ]; then
    return 0
  fi

  local picked=""
  if [ -x /usr/libexec/java_home ]; then
    picked="$(/usr/libexec/java_home -v 21 2>/dev/null || /usr/libexec/java_home -v 17 2>/dev/null || true)"
  fi

  if [ -z "$picked" ] || [ ! -x "${picked}/bin/java" ]; then
    echo "ERROR: Android Gradle 8.13 cannot run on Java ${major:-unknown}."
    echo "Install JDK 21 (the project compile target) and retry."
    exit 1
  fi

  export JAVA_HOME="$picked"
  export PATH="${JAVA_HOME}/bin:${PATH}"
  echo "Using $(java_spec_version "${JAVA_HOME}/bin/java") at ${JAVA_HOME} for Gradle."
  echo "The default Java ${major} is newer than Gradle 8.13 supports."
  echo ""
}

ensure_gradle_jdk
