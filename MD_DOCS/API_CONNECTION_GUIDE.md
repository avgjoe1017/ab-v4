# API Connection Guide

## Quick Diagnosis

If you're seeing "Network request failed" errors, the API server is likely not running.

## How to Start the API Server

### Option 1: Using pnpm (Recommended)
```bash
pnpm -C apps/api dev
```

### Option 2: Using PowerShell Script (Windows)
```powershell
powershell -ExecutionPolicy Bypass -File apps/api/start-dev.ps1
```

### Option 3: Direct Bun Command
```bash
cd apps/api
bun --watch src/index.ts
```

The API server should start on `http://localhost:8787`

## Verify API is Running

### From Browser
Open: `http://localhost:8787/health`

You should see: `{"ok":true}`

### From Mobile App
The app now shows an **API Connection Status** indicator at the top of the HomeScreen (in dev mode only). It will show:
- ✅ **Green**: API Connected
- ❌ **Red**: API Disconnected  
- ⏳ **Yellow**: Checking...

Tap the status indicator to manually refresh the connection check.

## Common Issues

### "API server is NOT running"
**Solution**: Start the API server using one of the methods above.

### "Network request failed" on Physical Device
**Problem**: Physical devices can't use `localhost` - they need your computer's IP address.

**Solution**: 
1. Find your computer's IP address:
   - Windows: `ipconfig` (look for IPv4 Address)
   - Mac/Linux: `ifconfig | grep "inet "`
   
2. Update `apps/mobile/app.json`:
   ```json
   "extra": {
     "PHYSICAL_DEVICE_IP": "192.168.1.XXX"  // Your computer's IP
   }
   ```

3. Restart the Expo dev server

### "Connection refused" or Port 8787 blocked
**Problem**: Firewall is blocking the connection.

**Solution**: 
- Windows: Allow port 8787 in Windows Firewall
- Mac: Check System Preferences > Security & Privacy > Firewall

### API URL Configuration

The app automatically detects the correct API URL based on your platform:
- **Android Emulator**: `http://10.0.2.2:8787` (automatic)
- **iOS Simulator**: `http://127.0.0.1:8787` (automatic)
- **Physical Device**: Uses `PHYSICAL_DEVICE_IP` from `app.json` or environment variable

You can override by setting:
- `EXPO_PUBLIC_API_BASE_URL` environment variable
- `API_BASE_URL` in `apps/mobile/app.json` extra section

## Testing Checklist

- [ ] API server is running (`http://localhost:8787/health` works in browser)
- [ ] API Connection Status shows green in the app
- [ ] Can see the API URL in the connection status indicator
- [ ] No "Network request failed" errors when using the app

## Need Help?

Check the console logs in your mobile app - they will show:
- The API URL being used
- Platform detection details
- Connection errors with details

