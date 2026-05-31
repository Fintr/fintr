# How to Debug iOS App Issues

## Method 1: View Logs in Xcode (Easiest)

1. **Connect your iPhone to your Mac** via USB
2. **Open Xcode**
3. Go to **Window** → **Devices and Simulators** (or press `Shift+Cmd+2`)
4. Select your iPhone from the left sidebar
5. Click **Open Console** button (or press `Shift+Cmd+C`)
6. **Filter the logs**:
   - In the search box, type "Fintr" or "console.log" or "Error"
   - Or look for red error messages
7. **Try to log in** in your app
8. **Watch the console** - you'll see all `console.log()` statements and errors

This will show you:
- Environment variables (if you added the debug component)
- Network errors
- API call failures
- Any JavaScript errors

## Method 2: Use the Debug Component (Visual)

I've added a debug component to your login page that shows environment variables on screen.

1. **Rebuild the app** with the debug component:
   ```bash
   cd fintr-fe
   ./scripts/mobile/build-production.sh
   ```

2. **Rebuild IPA** in Xcode

3. **Install on device**

4. **Open the login page** - you'll see a black debug box in the bottom-right corner showing:
   - All environment variables
   - Which ones are undefined (shown in red)
   - A button to copy values to console

## Method 3: Check Built Files

To verify environment variables are in the build:

```bash
cd fintr-fe/out

# Search for your backend URL in the built files
grep -r "your-backend-url" . | head -5

# Or search for NEXT_PUBLIC_BE_URL
grep -r "NEXT_PUBLIC_BE_URL" . | head -5
```

If you don't see your backend URL, the environment variables weren't included.

## Method 4: Add Alert for Quick Check

Temporarily add this to see the backend URL:

1. In your login component, add:
   ```typescript
   useEffect(() => {
     const backendUrl = process.env.NEXT_PUBLIC_BE_URL;
     if (!backendUrl) {
       alert("❌ Backend URL is UNDEFINED!\n\nCheck .env.mobile.production file");
     } else {
       console.log("✅ Backend URL:", backendUrl);
     }
   }, []);
   ```

2. Rebuild and test - you'll get an alert if the URL is missing

## What to Look For

### In Xcode Console:

**Good signs:**
```
✅ Backend URL: https://your-backend.com
✅ Login endpoint: https://your-backend.com/api/v1/auth/login
```

**Bad signs:**
```
❌ Backend URL: undefined
❌ Login endpoint: undefined/api/v1/auth/login
Error: Backend URL is not configured
```

**Network errors:**
```
Failed to load resource: The network connection was lost
Failed to fetch
CORS error
```

## Quick Fix Checklist

1. **Check `.env.mobile.production` exists**:
   ```bash
   cd fintr-fe
   ls -la .env.mobile.production
   ```

2. **Verify it has the right values**:
   ```bash
   cat .env.mobile.production
   ```

3. **Rebuild with environment variables**:
   ```bash
   ./scripts/mobile/build-production.sh
   ```

4. **Check if variables are in the build**:
   ```bash
   grep -r "NEXT_PUBLIC_BE_URL" out/ | head -3
   ```

5. **Rebuild IPA** in Xcode

6. **Check Xcode Console** when testing login

## Common Issues Found in Console

### "Backend URL is not configured"
- **Fix**: Make sure `.env.mobile.production` has `NEXT_PUBLIC_BE_URL=...`

### "Failed to fetch" or Network errors
- **Fix**: Check if backend URL is correct and accessible
- **Fix**: Check if it's HTTPS (required for production)

### "CORS error"
- **Fix**: Backend needs to allow requests from the app
- **Fix**: Add app origin to backend CORS whitelist

### "undefined/api/v1/auth/login"
- **Fix**: `NEXT_PUBLIC_BE_URL` is undefined - rebuild with environment variables

## Next Steps

1. **Use Xcode Console** (Method 1) - it's the easiest way to see what's happening
2. **Check the debug component** (Method 2) - visual confirmation of environment variables
3. **Share the console output** - the exact error message will tell us what's wrong

The Xcode Console method is the most reliable - you'll see exactly what's failing!
