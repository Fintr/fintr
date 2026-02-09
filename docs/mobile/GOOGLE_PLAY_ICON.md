# Google Play Console App Icon Guide

## Issue

The Google Play Console requires a **512x512px PNG icon** for the app listing. This is different from the launcher icons used in the app itself.

## Solution

A 512x512px icon has been created and is located at:
```
android/app/src/main/res/mipmap-xxxhdpi/ic_launcher_512.png
```

## How to Upload to Google Play Console

1. **Go to Google Play Console**:
   - Navigate to https://play.google.com/console
   - Select your app

2. **Navigate to Store Listing**:
   - In the left sidebar, go to **"Store presence"** → **"Store listing"**
   - Or go to **"Policy"** → **"App content"** → **"Store listing"**

3. **Upload the Icon**:
   - Scroll down to the **"App icon"** section
   - Click **"Upload"** or **"Choose file"**
   - Select the file: `android/app/src/main/res/mipmap-xxxhdpi/ic_launcher_512.png`
   - Wait for the upload to complete

4. **Icon Requirements** (already met):
   - ✅ Exactly 512 x 512 pixels
   - ✅ PNG format
   - ✅ No transparency (opaque background)
   - ✅ Square format

## Important Notes

- The app icon in Google Play Console is **separate** from the launcher icons in your app
- The launcher icons (192x192px) are used on users' devices
- The 512x512px icon is used in the Google Play Store listing
- You must upload this icon manually in the Play Console - it's not automatically extracted from your app bundle

## Troubleshooting

### Icon Not Showing After Upload
- Wait a few minutes for Google to process the upload
- Refresh the page
- Check that the file is exactly 512x512px
- Ensure the file is a valid PNG with no transparency issues

### Icon Looks Distorted
- The icon should be square (512x512px) - this is already correct
- Make sure the original logo is centered properly in the square format

## File Location

The 512x512px icon is located at:
```
android/app/src/main/res/mipmap-xxxhdpi/ic_launcher_512.png
```

You can also find it in the project at:
```
/Users/mikodagatan/Programming/fintr/fintr-fe/android/app/src/main/res/mipmap-xxxhdpi/ic_launcher_512.png
```
