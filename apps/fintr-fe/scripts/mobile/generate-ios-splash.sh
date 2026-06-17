#!/bin/bash
# Regenerate iOS Splash.imageset with the logo on the app background (#FAFAF8).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
SPLASH_DIR="$PROJECT_ROOT/ios/App/App/Assets.xcassets/Splash.imageset"
SOURCE_LOGO="$PROJECT_ROOT/public/fintr-logo.png"
WEB_SPLASH="$PROJECT_ROOT/public/fintr-logo-splash.png"
BG="#FAFAF8"

if ! command -v magick >/dev/null 2>&1; then
  echo "ImageMagick is required (brew install imagemagick)" >&2
  exit 1
fi

if [ ! -f "$SOURCE_LOGO" ]; then
  echo "Missing logo source: $SOURCE_LOGO" >&2
  exit 1
fi

make_splash() {
  local canvas_width="$1"
  local canvas_height="$2"
  local out="$3"
  local logo_width=$(( canvas_width * 88 / 100 ))

  magick "$SOURCE_LOGO" \
    -trim +repage \
    -resize "${logo_width}x" \
    -background "$BG" \
    -alpha remove \
    -alpha off \
    -gravity center \
    -extent "${canvas_width}x${canvas_height}" \
    -colorspace sRGB \
    "$out"
}

# 180×87 pt launch image at 1x / 2x / 3x
make_splash 180 87 "$SPLASH_DIR/fintr-logo@1x.png"
make_splash 360 174 "$SPLASH_DIR/fintr-logo@2x.png"
make_splash 540 261 "$SPLASH_DIR/fintr-logo@3x.png"

cp "$SPLASH_DIR/fintr-logo@1x.png" "$WEB_SPLASH"

echo "Updated iOS splash assets in $SPLASH_DIR"
echo "Updated web splash asset at $WEB_SPLASH"
