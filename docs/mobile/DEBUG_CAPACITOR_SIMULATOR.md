# Debug Capacitor App in iOS Simulator

## Using Safari Web Inspector (Best Method)

Safari Web Inspector lets you see console logs, network requests, and debug JavaScript just like in a browser.

### Step 1: Enable Web Inspector in Safari

1. **Open Safari** on your Mac
2. Go to **Safari** → **Preferences** (or **Settings** on macOS Ventura+)
3. Click the **Advanced** tab
4. Check **"Show features for web developers"** (or **"Show Develop menu in menu bar"** on older macOS)

### Step 2: Run Your App in the Simulator

```bash
cd fintr-fe
npx cap run ios
```

Or open the app in the simulator if it's already running.

### Step 3: Open Web Inspector

1. In Safari, go to **Develop** menu (top menu bar)
2. Hover over **[Your Mac Name]** → **iOS Simulator** → **[Device Name]**
3. You'll see your app listed (e.g., "Fintr - capacitor://localhost")
4. Click on it

This opens the Web Inspector with:
- **Console** tab - All console.log() statements
- **Network** tab - All HTTP requests (including to api.fintr.ai)
- **Sources** tab - JavaScript source code
- **Elements** tab - HTML/DOM inspection

### Step 4: Monitor the Login Request

1. Open the **Console** tab - you'll see all console.log() output
2. Open the **Network** tab
3. Try to log in
4. Watch for:
   - Console logs showing what's happening
   - Network requests to `api.fintr.ai`
   - Any error messages

## What to Look For

### In Console Tab:
```
🔍 Environment Variables Debug:
NEXT_PUBLIC_BE_URL: https://api.fintr.ai
...

🔍 Login Attempt Debug:
Backend URL: https://api.fintr.ai
Login endpoint: https://api.fintr.ai/api/v1/auth/login
```

### In Network Tab:
- Look for requests to `https://api.fintr.ai/api/v1/auth/login`
- Check the status code (200, 401, 403, 404, 500, etc.)
- Check if the request is even being made
- Look for CORS errors (red text)

## Your Authentication Flow

Based on your code, here's what happens when you log in:

1. **User enters credentials** → `unified-auth-page.tsx`
2. **Calls** `login({ username, password })` → from `AuthContext`
3. **AuthContext calls** `loginWithCredentials()` → from `services/auth/login.ts`
4. **Makes POST request** to `${NEXT_PUBLIC_BE_URL}/api/v1/auth/login`
5. **Your backend** validates credentials and returns tokens
6. **Your backend** handles Auth0 authentication internally

So your app **DOES** go through your backend first, not directly to Auth0.

## Why Your Backend Might Not Receive Requests

### Issue 1: Request Never Leaves the App (Most Likely)

The fetch request might be failing before it even reaches the network. Check Safari Web Inspector's Console for:

```
❌ TypeError: Failed to fetch
❌ Network request failed
❌ CORS error
```

### Issue 2: CORS Blocking the Request

Your backend needs to allow requests from Capacitor. Check your backend CORS configuration allows:

```
Origin: capacitor://localhost
Origin: fintrapp://
Origin: ionic://localhost
```

### Issue 3: SSL Certificate Issues

If your backend uses HTTPS with a self-signed certificate, iOS might block it.

### Issue 4: Network Configuration

The simulator might not have internet access or might be blocked by a firewall.

## Step-by-Step Debugging

### 1. Add Debug Logging (Temporary)

Add this to `src/services/auth/login.ts` (line 43):

```typescript
export const loginWithCredentials = async (
  credentials: LoginCredentials
): Promise<LoginResponse> => {
  const backendUrl = process.env.NEXT_PUBLIC_BE_URL;
  
  console.log('🔍 Login Debug:');
  console.log('Backend URL:', backendUrl);
  console.log('Full endpoint:', `${backendUrl}/api/v1/auth/login`);
  console.log('Credentials:', { username: credentials.username, password: '***' });

  if (!backendUrl) {
    throw new Error('Backend URL is not configured. Please check your environment variables.');
  }

  try {
    console.log('Making fetch request...');
    const response = await fetch(`${backendUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(credentials),
    });
    
    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));
    
    const data = await response.json();
    console.log('Response data:', data);
    
    // ... rest of the code
```

### 2. Rebuild and Test

```bash
cd fintr-fe
./scripts/mobile/build-production.sh
npx cap run ios
```

### 3. Open Safari Web Inspector and Check

You should see detailed logs showing exactly where it fails.

## Common Errors and Fixes

### "Failed to fetch" with no network request

**Cause**: Request blocked before it leaves the app
**Fix**: Check CORS, SSL certificate, or try using HTTP for local testing

### "Network request failed"

**Cause**: Can't reach the server
**Fix**: 
- Check if backend is running
- Try accessing the URL in Safari on simulator: `https://api.fintr.ai`
- Check if simulator has internet access

### CORS Error

**Cause**: Backend doesn't allow the app's origin
**Fix**: Add these to your backend's CORS allowed origins:
```
capacitor://localhost
fintrapp://
ionic://localhost
```

### "Backend URL is not configured"

**Cause**: Environment variable not in build
**Fix**: Run the verify script:
```bash
cd fintr-fe
./scripts/mobile/verify-build-env.sh
```

## Quick Test: Bypass Backend

To confirm if the issue is with the backend connection, temporarily test with a different endpoint:

```typescript
// In loginWithCredentials, temporarily change:
const response = await fetch('https://httpbin.org/post', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(credentials),
});
```

If this works, the issue is specific to your backend connection. If this also fails, the issue is with the app's network configuration.

