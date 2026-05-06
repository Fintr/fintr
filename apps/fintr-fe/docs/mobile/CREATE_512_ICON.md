# Creating 512x512px Icon from SVG Logo

This guide explains how to convert your SVG logo to a 512x512px PNG icon for Google Play Console.

## Available Tools on Your System

You have several tools available for converting SVG to PNG:

### 1. **rsvg-convert** (Recommended for SVG)
- **Location**: `/opt/homebrew/bin/rsvg-convert`
- **Best for**: SVG to PNG conversion (preserves vector quality)
- **Installation**: Already installed via Homebrew

### 2. **ImageMagick (convert/magick)**
- **Location**: `/opt/homebrew/bin/convert` or `/opt/homebrew/bin/magick`
- **Best for**: Image manipulation, adding backgrounds, resizing
- **Installation**: Already installed via Homebrew

### 3. **sips** (macOS Built-in)
- **Location**: `/usr/bin/sips`
- **Best for**: Quick image resizing (but doesn't handle SVG well)
- **Installation**: Built into macOS

## Recommended Method: Using rsvg-convert + ImageMagick

This is the best approach for converting SVG to PNG with proper background handling:

### Step 1: Convert SVG to PNG (512x512px)

```bash
rsvg-convert \
  --width=512 \
  --height=512 \
  --format=png \
  --output=/tmp/fintr_512.png \
  /path/to/Fintr_Logo_Deep\ Navy_Transparent.svg
```

### Step 2: Add White Background (if needed)

Since Google Play requires no transparency, add a white background:

```bash
magick /tmp/fintr_512.png \
  -background white \
  -gravity center \
  -extent 512x512 \
  android/app/src/main/res/mipmap-xxxhdpi/ic_launcher_512.png
```

Or using the older `convert` command:

```bash
convert /tmp/fintr_512.png \
  -background white \
  -gravity center \
  -extent 512x512 \
  android/app/src/main/res/mipmap-xxxhdpi/ic_launcher_512.png
```

## Complete One-Line Command

Download from GitHub and convert in one go:

```bash
curl -L "https://raw.githubusercontent.com/Fintr/Fintr-Logos/main/Fintr_Logo_Deep%20Navy_Transparent.svg" | \
  rsvg-convert --width=512 --height=512 --format=png | \
  magick - -background white -gravity center -extent 512x512 \
  android/app/src/main/res/mipmap-xxxhdpi/ic_launcher_512.png
```

## Alternative Tools (If Needed)

### Online Tools
- **CloudConvert** (https://cloudconvert.com/svg-to-png)
- **Zamzar** (https://www.zamzar.com/convert/svg-to-png/)
- **Figma** - Import SVG, export as PNG at 512x512px

### Desktop Applications
- **Inkscape** (Free, open-source)
  ```bash
  brew install --cask inkscape
  inkscape --export-type=png --export-width=512 --export-height=512 logo.svg
  ```

- **GIMP** (Free image editor)
  - File → Open → Select SVG
  - Image → Scale Image → Set to 512x512px
  - File → Export As → PNG

- **Adobe Illustrator/Photoshop** (Professional tools)

## Google Play Console Requirements

When creating your 512x512px icon, ensure:

- ✅ **Size**: Exactly 512px × 512px
- ✅ **Format**: PNG (32-bit)
- ✅ **Color space**: sRGB
- ✅ **Max file size**: 1024KB
- ✅ **Shape**: Full square (Google Play handles masking)
- ✅ **Background**: Opaque (no transparency)

## Verification

Check your icon meets requirements:

```bash
# Check dimensions
sips -g pixelWidth -g pixelHeight android/app/src/main/res/mipmap-xxxhdpi/ic_launcher_512.png

# Check file size
ls -lh android/app/src/main/res/mipmap-xxxhdpi/ic_launcher_512.png

# Check format
file android/app/src/main/res/mipmap-xxxhdpi/ic_launcher_512.png
```

## Using Different Logo Variants

If you want to use a different logo from the Fintr-Logos repository:

1. Browse the repository: https://github.com/Fintr/Fintr-Logos
2. Find the SVG file you want
3. Replace the URL in the curl command above
4. Run the conversion command

## Troubleshooting

### "rsvg-convert: command not found"
```bash
brew install librsvg
```

### "magick: command not found"
```bash
brew install imagemagick
```

### Logo appears too small in 512x512px
- The SVG might have extra whitespace
- Try using `--keep-aspect-ratio` with rsvg-convert
- Or manually adjust the viewBox in the SVG

### Transparency issues
- Google Play requires opaque backgrounds
- Always add a white background using ImageMagick's `-background white` option
