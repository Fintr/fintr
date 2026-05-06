# iOS App Icon Setup

This directory contains all the app icons for iOS.

## Icon Sizes

### iPhone Icons
- 20x20 @ 2x, 3x (40x40, 60x60)
- 29x29 @ 2x, 3x (58x58, 87x87)
- 40x40 @ 2x, 3x (80x80, 120x120)
- 60x60 @ 2x, 3x (120x120, 180x180)

### iPad Icons
- 167x167 @ 1x (iPad Pro)
- 152x152 @ 1x (iPad iOS >= 10.0)

### Marketing
- 1024x1024 @ 1x (App Store)

## Regenerating Icons

If you need to regenerate the iPad icons from the source:

```bash
cd ios/App/App/Assets.xcassets/AppIcon.appiconset
./generate-ipad-icons.sh
```

This will:
1. Generate `AppIcon-167.png` (167x167) from `AppIcon-1024.png`
2. Generate `AppIcon-152.png` (152x152) from `AppIcon-1024.png`
3. Update `Contents.json` automatically

## Source Icon

The source icon is `AppIcon-1024.png` (1024x1024 pixels). All other icons are generated from this source.

## Validation

When distributing to App Store, ensure:
- ✅ All required icon sizes are present
- ✅ Icons are in PNG format
- ✅ Icons match the exact pixel dimensions
- ✅ Contents.json references all icons correctly

