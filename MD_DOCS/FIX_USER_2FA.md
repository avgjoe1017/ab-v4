# Fix: User Account Has 2FA Enabled

**Problem**: Sign-in shows `needs_second_factor` even though app-level 2FA is disabled.

**Cause**: The user account itself has 2FA enabled (not the app setting).

---

## Solution: Disable 2FA on the User Account

### Option 1: Via Clerk Dashboard (Recommended)

1. Go to **Clerk Dashboard** → https://dashboard.clerk.com
2. Click **Users** in the left sidebar
3. Find your user account (search by email)
4. Click on the user to open their profile
5. Go to **Security** tab
6. Find **Multi-factor authentication** section
7. **Remove** or **Disable** any 2FA methods (SMS, Authenticator app, etc.)
8. Save changes

### Option 2: Delete and Recreate User

1. Go to **Users** in Clerk dashboard
2. Find your user account
3. Click **Delete** (or **Remove**)
4. Sign up again with the same email in your app
5. New account won't have 2FA enabled

### Option 3: Sign Up with Different Email

**Easiest for development**:
- Use a different email address to sign up
- New accounts won't have 2FA enabled
- You can use a test email like `test@example.com` or `dev+1@yourdomain.com`

---

## Why This Happens

Clerk has two levels of 2FA:
1. **App-level**: Controls whether 2FA is available/required for the app
2. **User-level**: Individual users can enable 2FA on their accounts

Even if app-level 2FA is disabled, users who previously enabled 2FA will still have it on their accounts.

---

## Quick Test

After disabling 2FA on the user account:
1. Try signing in again
2. Status should be `complete` instead of `needs_second_factor`
3. Sign-in should work

---

**Last Updated**: January 2025

