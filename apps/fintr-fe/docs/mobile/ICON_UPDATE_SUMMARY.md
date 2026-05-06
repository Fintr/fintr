# Android Icon Update Summary

All default Android logos have been replaced with the Fintr logo from the [Fintr-Logos repository](https://github.com/Fintr/Fintr-Logos).

## Updated Icons

### Launcher Icons (ic_launcher.png)
All launcher icons have been generated from the Fintr SVG logo:

- **mipmap-ldpi**: 36x36px
- **mipmap-mdpi**: 48x48px
- **mipmap-hdpi**: 72x72px
- **mipmap-xhdpi**: 96x96px
- **mipmap-xxhdpi**: 144x144px
- **mipmap-xxxhdpi**: 192x192px

**Location**: `android/app/src/main/res/mipmap-*/ic_launcher.png`

### Foreground Icons (ic_launcher_foreground.png)
Foreground icons for adaptive icons (Android 8.0+):

- **mipmap-mdpi**: 108x108px
- **mipmap-hdpi**: 162x162px
- **mipmap-xhdpi**: 216x216px
- **mipmap-xxhdpi**: 324x324px
- **mipmap-xxxhdpi**: 432x432px

**Location**: `android/app/src/main/res/mipmap-*/ic_launcher_foreground.png`

### Round Icons (ic_launcher_round.png)
Properly rounded launcher icons with circular mask and transparent background:

- **mipmap-mdpi**: 48x48px
- **mipmap-hdpi**: 72x72px
- **mipmap-xhdpi**: 96x96px
- **mipmap-xxhdpi**: 144x144px
- **mipmap-xxxhdpi**: 192x192px

**Location**: `android/app/src/main/res/mipmap-*/ic_launcher_round.png`

**Format**: PNG with RGBA (8-bit sRGB with alpha channel)
- Circular shape with transparent background outside the circle
- Fintr logo centered on white background within the circle
- Color preserved (not grayscale)

### Google Play Console Icon (ic_launcher_512.png)
512x512px icon for Google Play Console store listing:

- **mipmap-xxxhdpi**: 512x512px

**Location**: `android/app/src/main/res/mipmap-xxxhdpi/ic_launcher_512.png`

### Splash Screens (splash.png)
All splash screens have been updated with the Fintr logo centered on white background:

**Portrait:**
- **drawable-port-mdpi**: 320x480px
- **drawable-port-hdpi**: 480x800px
- **drawable-port-xhdpi**: 720x1280px
- **drawable-port-xxhdpi**: 960x1600px
- **drawable-port-xxxhdpi**: 1280x1920px

**Landscape:**
- **drawable-land-mdpi**: 480x320px
- **drawable-land-hdpi**: 800x480px
- **drawable-land-xhdpi**: 1280x720px
- **drawable-land-xxhdpi**: 1600x960px
- **drawable-land-xxxhdpi**: 1920x1280px

**Default:**
- **drawable**: 480x320px

**Location**: `android/app/src/main/res/drawable*/splash.png`

## Configuration Updates

### Adaptive Icon XML Files
Updated to use the correct foreground resource:

- `android/app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml`
- `android/app/src/main/res/mipmap-anydpi-v26/ic_launcher_round.xml`

Both now correctly reference `@mipmap/ic_launcher_foreground` instead of `@mipmap/ic_launcher`.

## Source Logo

All icons were generated from:
- **Source**: `Fintr_Logo_Deep Navy_Transparent.svg`
- **Repository**: https://github.com/Fintr/Fintr-Logos
- **Path**: `main/Fintr_Logo_Deep%20Navy_Transparent.svg`

## Icon Specifications

### Launcher Icons
- **Format**: PNG
- **Background**: White (opaque)
- **Content**: Fintr logo centered

### Foreground Icons (Adaptive)
- **Format**: PNG
- **Background**: Transparent
- **Content**: Fintr logo (will be overlaid on background color)
- **Size**: 108dp (scaled for each density)

### Splash Screens
- **Format**: PNG
- **Background**: White
- **Content**: Fintr logo centered (scaled to ~30% of screen width)

## Regenerating Icons

To regenerate all icons from the SVG source, use:

```bash
# Download the SVG
curl -L "https://raw.githubusercontent.com/Fintr/Fintr-Logos/main/Fintr_Logo_Deep%20Navy_Transparent.svg" \
  -o /tmp/fintr_logo.svg

# Run the generation script (see CREATE_512_ICON.md for details)
```

## Verification

All icons have been verified:
- ✅ 6 launcher icons (all densities)
- ✅ 5 foreground icons (adaptive icon support)
- ✅ 5 round icons
- ✅ 11 splash screens (portrait, landscape, default)
- ✅ 1 Google Play Console icon (512x512px)

## Next Steps

1. **Test the app**: Build and run the app to verify icons display correctly
2. **Upload to Google Play**: Use `ic_launcher_512.png` for the Play Console store listing
3. **Update if needed**: If you want to use a different logo variant, see `CREATE_512_ICON.md`
