# Apple Sign In Troubleshooting: "invalid_client" Error

## The Problem

You're seeing an `invalid_client` error from Apple when trying to sign in. This means Apple doesn't recognize the Client ID (Service ID) that Auth0 is using.

## Most Common Cause

The **Client ID** in Auth0 doesn't match the **Service ID** you configured in Apple Developer Portal.

## Solution: Verify Service ID Configuration

### Step 1: Check Your Service ID in Apple Developer Portal

1. Go to [Apple Developer Portal - Identifiers](https://developer.apple.com/account/resources/identifiers/list)
2. Find your **Services ID** (the one you created in step 2.2, e.g., `com.fintr.app.service`)
3. Click on it to view details
4. Make sure:
   - ✅ **Sign In with Apple** is enabled
   - ✅ It's configured with your Primary App ID: `com.fintr.app`
   - ✅ The **Return URLs** include: `https://fintr.jp.auth0.com/login/callback`

### Step 2: Verify Service ID in Auth0

1. Go to [Auth0 Dashboard](https://manage.auth0.com)
2. Navigate to **Authentication** → **Social** → **Apple**
3. Check the **Client ID** field
4. **It MUST match** your Service ID from Apple Developer Portal exactly
   - If your Service ID is `com.fintr.app.service`, Auth0's Client ID must be `com.fintr.app.service`
   - Case-sensitive! `com.fintr.app.service` ≠ `Com.Fintr.App.Service`

### Step 3: Verify Return URL Configuration

In Apple Developer Portal, your Service ID's Return URLs must include:
- `https://fintr.jp.auth0.com/login/callback`

**To check/fix:**
1. Go to [Apple Developer Portal - Identifiers](https://developer.apple.com/account/resources/identifiers/list)
2. Click on your Service ID
3. Click **Edit**
4. Under **Sign In with Apple**, click **Configure**
5. Verify **Return URLs** includes: `https://fintr.jp.auth0.com/login/callback`
6. If not, add it and click **Save**

## Other Common Issues

### Issue 1: Service ID Not Configured for Sign In with Apple

**Symptoms:** `invalid_client` error

**Fix:**
1. Go to Apple Developer Portal → Identifiers
2. Select your Service ID
3. Make sure **Sign In with Apple** is checked
4. Click **Configure** and verify:
   - Primary App ID is set to `com.fintr.app`
   - Return URLs include `https://fintr.jp.auth0.com/login/callback`

### Issue 2: Wrong Client ID in Auth0

**Symptoms:** `invalid_client` error

**Fix:**
1. In Auth0 Dashboard → Authentication → Social → Apple
2. Check the **Client ID** field
3. It should be your **Service ID** (e.g., `com.fintr.app.service`)
4. **NOT** your App ID (`com.fintr.app`)
5. Update if incorrect and save

### Issue 3: Return URL Mismatch

**Symptoms:** `invalid_client` or redirect errors

**Fix:**
1. In Apple Developer Portal, your Service ID's Return URLs must include:
   - `https://fintr.jp.auth0.com/login/callback`
2. In Auth0, check your Application's **Allowed Callback URLs**:
   - Should include your app's callback URL
   - For web: `https://your-domain.com/auth-callback`
   - For mobile: `com.fintr.app://auth-callback` (if using custom URL scheme)

### Issue 4: Team ID or Key ID Mismatch

**Symptoms:** `invalid_client` or authentication failures

**Fix:**
1. Verify **Team ID** in Auth0 matches your Apple Developer Team ID
2. Verify **Key ID** in Auth0 matches the Key ID from the key you created
3. Verify **Private Key** in Auth0 is the complete contents of the `.p8` file

## Quick Checklist

Before testing again, verify:

- [ ] Service ID exists in Apple Developer Portal (e.g., `com.fintr.app.service`)
- [ ] Service ID has "Sign In with Apple" enabled
- [ ] Service ID is configured with Primary App ID: `com.fintr.app`
- [ ] Service ID's Return URLs include: `https://fintr.jp.auth0.com/login/callback`
- [ ] Auth0 Apple connection's **Client ID** matches your Service ID exactly
- [ ] Auth0 Apple connection's **Team ID** is correct
- [ ] Auth0 Apple connection's **Key ID** is correct
- [ ] Auth0 Apple connection's **Private Key** includes BEGIN/END lines
- [ ] Apple connection is enabled for your Auth0 Application

## Still Not Working?

1. **Double-check the Service ID** - It's the most common issue
2. **Wait a few minutes** - Apple's changes can take a few minutes to propagate
3. **Clear browser cache** - Sometimes cached configurations cause issues
4. **Check Auth0 logs** - Go to Auth0 Dashboard → Monitoring → Logs to see detailed error messages
5. **Verify all IDs match exactly** - Case-sensitive, no extra spaces

## Need More Help?

- Check Auth0's [Apple Social Connection documentation](https://auth0.com/docs/authenticate/identity-providers/social-identity-providers/apple)
- Check Apple's [Sign In with Apple documentation](https://developer.apple.com/sign-in-with-apple/)

