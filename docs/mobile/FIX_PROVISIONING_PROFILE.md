# Fix: Provisioning Profile Missing Certificate

## Problem
Provisioning profile "Fintr App Store Distribution" doesn't include the signing certificate.

## Solution

### Option 1: Edit Existing Profile (Recommended)
1. Go to: https://developer.apple.com/account/resources/profiles/list
2. Find "Fintr App Store Distribution"
3. Click **Edit**
4. Under **Certificates**, select: "Apple Distribution: Joel Paolo Paraiso (2D7JCZ3SVD)"
5. Click **Generate** or **Save**
6. Download the updated `.mobileprovision` file
7. Double-click to install

### Option 2: Create New Profile
1. Go to: https://developer.apple.com/account/resources/profiles/list
2. Click **"+"** → Select **"App Store"** → Continue
3. Select App ID: **com.fintr.app** → Continue
4. Select Certificate: **Apple Distribution: Joel Paolo Paraiso (2D7JCZ3SVD)** → Continue
5. Name: **Fintr App Store Distribution** → Generate
6. Download and install

### After Installing
1. In Xcode → Signing & Capabilities
2. Select the provisioning profile from dropdown
3. Signing Certificate should now show: "Apple Distribution: Joel Paolo Paraiso (2D7JCZ3SVD)"

