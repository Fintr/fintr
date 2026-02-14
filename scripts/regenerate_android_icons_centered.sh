#!/usr/bin/env bash
# Regenerate Android launcher icons with the Fintr logo scaled to 66% and centered
# so it stays inside the circular mask (no text bleeding outside).
# Requires: librsvg (rsvg-convert), ImageMagick (magick)
# Usage: from repo root: bash scripts/regenerate_android_icons_centered.sh

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ANDROID_RES="${SCRIPT_DIR}/../android/app/src/main/res"
SVG_URL="https://raw.githubusercontent.com/Fintr/Fintr-Logos/main/Fintr_Logo_Deep%20Navy_Transparent.svg"
SAFE_SCALE="0.66"   # Android adaptive icon safe zone; keeps logo inside circle

command -v rsvg-convert >/dev/null 2>&1 || { echo "Need rsvg-convert (brew install librsvg)."; exit 1; }
command -v magick >/dev/null 2>&1 || { echo "Need ImageMagick (brew install imagemagick)."; exit 1; }

SVG_FILE="/tmp/fintr_logo_$$.svg"
curl -sL "$SVG_URL" -o "$SVG_FILE"
trap "rm -f $SVG_FILE" EXIT

gen_icon() {
  local size=$1
  local out_path=$2
  local logo_size
  logo_size=$(awk "BEGIN { printf \"%.0f\", $size * $SAFE_SCALE }")
  mkdir -p "$(dirname "$out_path")"
  rsvg-convert --width="$logo_size" --height="$logo_size" --format=png "$SVG_FILE" | \
    magick - -background white -gravity center -extent "${size}x${size}" "$out_path"
  echo "  $out_path"
}

gen_foreground() {
  local size=$1
  local out_path=$2
  local logo_size
  logo_size=$(awk "BEGIN { printf \"%.0f\", $size * $SAFE_SCALE }")
  mkdir -p "$(dirname "$out_path")"
  rsvg-convert --width="$logo_size" --height="$logo_size" --format=png "$SVG_FILE" | \
    magick - -background none -gravity center -extent "${size}x${size}" "$out_path"
  echo "  $out_path"
}

# Round icon: same as launcher but with circular mask (transparent outside circle).
# Uses -fx with antialiased edge (linear fade over ~1.5px) for a smooth circle.
gen_round_icon() {
  local size=$1
  local out_path=$2
  local logo_size
  logo_size=$(awk "BEGIN { printf \"%.0f\", $size * $SAFE_SCALE }")
  mkdir -p "$(dirname "$out_path")"
  local square_tmp="/tmp/fintr_icon_square_$$_${size}.png"
  rsvg-convert --width="$logo_size" --height="$logo_size" --format=png "$SVG_FILE" | \
    magick - -background white -gravity center -extent "${size}x${size}" "$square_tmp"
  # Antialiased circle: linear fade over 1.5px at edge for smooth edge (no jagged pixels).
  magick "$square_tmp" -alpha set -channel A \
    -fx "max(0, min(1, (min(w,h)/2+1.5-hypot(i+0.5-w/2, j+0.5-h/2))/1.5))" +channel \
    -alpha on -depth 8 "$out_path"
  rm -f "$square_tmp"
  echo "  $out_path"
}

echo "Generating launcher icons (logo at ${SAFE_SCALE} scale, centered)..."
gen_icon 36  "${ANDROID_RES}/mipmap-ldpi/ic_launcher.png"
gen_icon 48  "${ANDROID_RES}/mipmap-mdpi/ic_launcher.png"
gen_icon 72  "${ANDROID_RES}/mipmap-hdpi/ic_launcher.png"
gen_icon 96  "${ANDROID_RES}/mipmap-xhdpi/ic_launcher.png"
gen_icon 144 "${ANDROID_RES}/mipmap-xxhdpi/ic_launcher.png"
gen_icon 192 "${ANDROID_RES}/mipmap-xxxhdpi/ic_launcher.png"

echo "Generating round launcher icons (circular mask)..."
gen_round_icon 48  "${ANDROID_RES}/mipmap-mdpi/ic_launcher_round.png"
gen_round_icon 72  "${ANDROID_RES}/mipmap-hdpi/ic_launcher_round.png"
gen_round_icon 96  "${ANDROID_RES}/mipmap-xhdpi/ic_launcher_round.png"
gen_round_icon 144 "${ANDROID_RES}/mipmap-xxhdpi/ic_launcher_round.png"
gen_round_icon 192 "${ANDROID_RES}/mipmap-xxxhdpi/ic_launcher_round.png"

echo "Generating adaptive foreground icons..."
gen_foreground 108 "${ANDROID_RES}/mipmap-mdpi/ic_launcher_foreground.png"
gen_foreground 162 "${ANDROID_RES}/mipmap-hdpi/ic_launcher_foreground.png"
gen_foreground 216 "${ANDROID_RES}/mipmap-xhdpi/ic_launcher_foreground.png"
gen_foreground 324 "${ANDROID_RES}/mipmap-xxhdpi/ic_launcher_foreground.png"
gen_foreground 432 "${ANDROID_RES}/mipmap-xxxhdpi/ic_launcher_foreground.png"

echo "Generating 512px Play Store icon..."
gen_icon 512 "${ANDROID_RES}/mipmap-xxxhdpi/ic_launcher_512.png"

echo "Done. Rebuild the Android app to see the updated icons."
