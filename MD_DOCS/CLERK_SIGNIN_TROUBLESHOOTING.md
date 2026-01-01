# Clerk Sign-In Troubleshooting

**Issue**: Sign-in shows `needs_second_factor` even though 2FA is disabled in app settings.

---

## Possible Causes

### 1. User Account Has 2FA Enabled (Most Likely)

Even if app-level 2FA is disabled, individual user accounts can have 2FA enabled.

**Solution**: 
- Sign up with a **new account** (recommended for development)
- Or disable 2FA on the existing user account in Clerk dashboard:
  - Go to **Users** → Find your user → **Security** → Disable 2FA

### 2. Bot Protection Interfering

Clerk's bot protection can sometimes trigger 2FA-like behavior.

**Solution**:
1. Go to Clerk Dashboard
2. **User & Authentication** → **Attack Protection**
3. Disable **Bot sign-up protection** (temporarily for development)

### 3. Missing Dependencies

React Native/Expo might be missing required packages.

**Check if installed**:
```bash
cd apps/mobile
pnpm list expo-auth-session expo-web-browser
```

**Install if missing**:
```bash
pnpm add expo-auth-session expo-web-browser
```

### 4. React Native Redirect Error

The `href` error happens because Clerk tries to do web redirects which React Native doesn't support.

**Current Fix**: Error handling catches this, but sign-in might still fail.

---

## Quick Fix: Sign Up New Account

**Easiest solution**: Sign up with a fresh email address. New accounts won't have 2FA enabled.

---

## Check User Account 2FA Status

1. Go to Clerk Dashboard → **Users**
2. Find your user account
3. Check **Security** tab
4. See if 2FA is enabled on the account itself

---

## Debug Steps

1. **Check console logs** - Look for:
   - `[SignIn] Sign-in result status: needs_second_factor`
   - `[SignIn] Full result:` - This will show what Clerk is returning

2. **Try sign-up instead** - New accounts shouldn't have 2FA

3. **Check Clerk dashboard**:
   - User account 2FA status
   - Bot protection settings
   - Attack protection settings

---

**Last Updated**: January 2025

