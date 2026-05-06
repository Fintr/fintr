# Publishing Fintr to the App Store

This guide walks you through publishing your iOS app to the App Store.

## 📦 Accessing Your Archive

Your archive has been uploaded to Apple. Here's how to access it:

### Option 1: Xcode Organizer (Local Archive)
- **Location**: `~/Library/Developer/Xcode/Archives/YYYY-MM-DD/`
- **Access**: Xcode → Window → Organizer (Shift+Cmd+O)
- **Note**: The archive file (`.xcarchive`) is stored locally but the uploaded version is in App Store Connect

### Option 2: App Store Connect (Uploaded Archive)
- **URL**: https://appstoreconnect.apple.com
- **Login**: Use your Apple Developer account
- **Navigate**: My Apps → Fintr → TestFlight or App Store

## 🚀 Publishing Steps

### Step 1: Access App Store Connect

1. Go to https://appstoreconnect.apple.com
2. Sign in with your Apple Developer account
3. Click **"My Apps"**
4. Select **"Fintr"** (or create a new app if it doesn't exist)

### Step 2: Complete App Information

If this is your first submission, you'll need to complete:

#### A. App Information
- **Name**: Fintr
- **Primary Language**: English
- **Bundle ID**: com.fintr.app
- **SKU**: (unique identifier, e.g., "fintr-001")
- **User Access**: Full Access (or Limited Access if using App Store Connect API)

#### B. Pricing and Availability
- Set price (Free or Paid)
- Select countries/regions
- Set availability date

#### C. App Privacy
- Complete privacy questionnaire
- Add privacy policy URL (required)
- Specify data collection practices

### Step 3: Prepare App Store Listing

#### Required Information:
1. **App Name**: Fintr (max 30 characters)
2. **Subtitle**: (optional, max 30 characters)
3. **Description**: 
   - Short description (up to 170 characters)
   - Full description (up to 4,000 characters)
4. **Keywords**: (up to 100 characters, comma-separated)
5. **Support URL**: Your support website
6. **Marketing URL**: (optional) Your marketing website
7. **Privacy Policy URL**: (required) Your privacy policy

#### Screenshots (Required):
- **iPhone 6.7" Display** (iPhone 14 Pro Max, 15 Pro Max): 1290 x 2796 pixels
- **iPhone 6.5" Display** (iPhone 11 Pro Max, XS Max): 1242 x 2688 pixels
- **iPhone 5.5" Display** (iPhone 8 Plus): 1242 x 2208 pixels
- **iPad Pro 12.9"**: 2048 x 2732 pixels
- **iPad Pro 11"**: 1668 x 2388 pixels

**Note**: You need at least one screenshot set. Screenshots must show the actual app, not placeholders.

#### App Preview Videos (Optional):
- Same sizes as screenshots
- Up to 30 seconds
- Show app functionality

#### App Icon:
- 1024 x 1024 pixels (already configured in your project)
- **Location**: Usually extracted automatically from your build
- **If not showing**: You can manually upload it in App Store Connect (see below)

### Step 4: App Icon (If Not Showing)

The app icon is usually automatically extracted from your build, but if it's not showing:

1. In App Store Connect, go to **"App Information"** (left sidebar under General)
2. Scroll down to **"App Icon"** section
3. Click **"Choose File"** or drag and drop your 1024x1024 icon
4. **Icon file location**: `ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-1024.png`
5. **Requirements**:
   - Exactly 1024 x 1024 pixels
   - PNG format
   - No transparency (must have opaque background)
   - No rounded corners (Apple adds them automatically)
   - No alpha channel

**Note**: The icon should appear automatically once your build finishes processing. If it doesn't show after processing, upload it manually.

### Step 5: Build Information

1. In App Store Connect, go to **"TestFlight"** or **"App Store"** tab
2. Under **"Build"**, you should see your uploaded archive
3. If you see "Processing", wait for Apple to process it (usually 10-30 minutes)
4. Once processed, select the build for submission

### Step 6: Version Information

1. Go to **"App Store"** tab → **"1.0 Prepare for Submission"**
2. Fill in:
   - **Version**: 1.0
   - **Copyright**: © 2025 Your Company Name
   - **What's New in This Version**: (first version, describe your app)
   - **App Review Information**:
     - Contact information
     - Demo account (if login required)
     - Notes (any special instructions for reviewers)

### Step 7: Age Rating

Complete the age rating questionnaire:
- Select content categories
- Answer questions about content
- Get your age rating (4+, 9+, 12+, 17+)

### Step 8: Submit for Review

1. Review all information
2. Ensure all required fields are completed
3. Click **"Add for Review"** or **"Submit for Review"**
4. Answer export compliance questions (if applicable)
5. Submit!

## ⏱️ Review Timeline

- **Initial Review**: Usually 24-48 hours
- **Rejection**: If issues found, you'll get feedback
- **Approval**: App goes live (or scheduled release)

## 📋 Pre-Submission Checklist

- [ ] App builds and runs without crashes
- [ ] All app icons are correct sizes
- [ ] Launch screen displays correctly
- [ ] Privacy policy URL is accessible
- [ ] Support URL is accessible
- [ ] App description is complete
- [ ] Screenshots are ready (at least one set)
- [ ] Age rating completed
- [ ] App Review information filled out
- [ ] Demo account created (if login required)
- [ ] Tested on physical device
- [ ] All features work as expected

## 🔍 Common Issues & Solutions

### Issue: "Missing Compliance"
**Solution**: Answer export compliance questions in App Store Connect

### Issue: "Invalid Binary"
**Solution**: 
- Check that you're using the correct provisioning profile
- Ensure bundle ID matches App Store Connect
- Verify signing certificates are valid

### Issue: "Missing Screenshots"
**Solution**: Upload at least one set of screenshots for required device sizes

### Issue: "Privacy Policy Required"
**Solution**: Add a privacy policy URL in App Information

### Issue: "App Review Rejection"
**Solution**: 
- Read the rejection reason carefully
- Fix the issues mentioned
- Resubmit with explanation of fixes

## 📱 TestFlight (Beta Testing)

Before public release, you can use TestFlight:

1. Go to **TestFlight** tab in App Store Connect
2. Add internal testers (up to 100, instant access)
3. Add external testers (up to 10,000, requires review)
4. Share TestFlight link with testers
5. Collect feedback before public release

## 🔗 Useful Links

- **App Store Connect**: https://appstoreconnect.apple.com
- **Apple Developer Portal**: https://developer.apple.com/account
- **App Review Guidelines**: https://developer.apple.com/app-store/review/guidelines/
- **Human Interface Guidelines**: https://developer.apple.com/design/human-interface-guidelines/

## 📝 Notes

- Your archive shows "Uploaded to Apple" - this means it's successfully uploaded
- The archive is processed by Apple (usually 10-30 minutes)
- Once processed, you can select it for submission
- You can upload multiple builds - only submit the one you want to release

## 🎯 Next Steps

1. **Right Now**: Go to App Store Connect and check if your build is processed
2. **Complete App Information**: Fill in all required fields
3. **Prepare Screenshots**: Take screenshots of your app on different device sizes
4. **Submit for Review**: Once everything is ready, submit!

Good luck with your app submission! 🚀

