# Clerk Setup Verification

**Date**: January 2025  
**Status**: Keys Configured - Ready to Test

---

## ✅ Configuration Status

### Mobile App (`apps/mobile/app.json`)
- ✅ **CLERK_PUBLISHABLE_KEY** is configured in `app.json` extra section
- Key: `pk_test_Y2xhc3NpYy1zdGFybGluZy0yMi5jbGVyay5hY2NvdW50cy5kZXYk`

### API Server (`apps/api/.env`)
- ⚠️ **CLERK_SECRET_KEY** needs to be added to `.env` file
- Required key: `sk_test_RENJsjKrZuhwv1x2azTQIlOjM1fzQA5x71pnaCuxh9`

---

## 🔧 Setup Instructions

### Step 1: Add Secret Key to API

Create or update `apps/api/.env`:

```bash
# Clerk Authentication
CLERK_SECRET_KEY=sk_test_RENJsjKrZuhwv1x2azTQIlOjM1fzQA5x71pnaCuxh9

# Database (keep existing)
DATABASE_URL=file:./dev.db

# Other existing variables...
```

### Step 2: Verify Mobile App Configuration

The mobile app already has the key in `app.json`:
```json
"extra": {
  "CLERK_PUBLISHABLE_KEY": "pk_test_Y2xhc3NpYy1zdGFybGluZy0yMi5jbGVyay5hY2NvdW50cy5kZXYk"
}
```

This is correct! ✅

---

## 🧪 Testing Authentication

### Step 1: Start API Server

```bash
cd apps/api
bun --watch src/index.ts
```

**Check logs for**:
```
[api] Clerk configured: true
```

If you see `Clerk configured: true`, the secret key is loaded correctly.

### Step 2: Start Mobile App

```bash
cd apps/mobile
pnpm start
```

### Step 3: Test Sign-In Flow

1. **Open mobile app** (iOS simulator, Android emulator, or physical device)
2. **Look for Clerk sign-in UI** - The app should show Clerk's authentication UI
3. **Sign up or sign in** with an email
4. **Check API logs** - You should see:
   - Token verification attempts
   - User creation (if new user)
   - Successful authentication

### Step 4: Verify User Creation

After signing in, check the database:

```bash
cd apps/api
bun prisma studio
```

Or query directly:
```bash
bun -e "import { prisma } from './src/lib/db.ts'; const users = await prisma.user.findMany(); console.log(users);"
```

You should see a new user record with:
- `id` matching the Clerk user ID (starts with `user_`)
- `email` from the Clerk account

---

## 🔍 Troubleshooting

### Issue: "Clerk configured: false"

**Solution**: 
- Check that `CLERK_SECRET_KEY` is in `apps/api/.env`
- Restart the API server after adding the key
- Verify no typos in the key

### Issue: Mobile app doesn't show Clerk UI

**Solution**:
- Check `app.json` has `CLERK_PUBLISHABLE_KEY` in `extra` section
- Restart Expo dev server: `pnpm start --clear`
- Check console for errors

### Issue: "Token verification failed" in API logs

**Possible causes**:
- Secret key doesn't match publishable key (different Clerk apps)
- Token expired (try signing in again)
- Clock skew (check system time)

**Solution**:
- Verify both keys are from the same Clerk application
- Check Clerk dashboard to confirm keys are active

### Issue: User not created in database

**Check**:
- API endpoint `/sessions` or `/me/entitlement` should create user automatically
- Check API logs for user creation errors
- Verify database is accessible

---

## ✅ Success Criteria

Authentication is working when:

- [ ] API server logs show `Clerk configured: true`
- [ ] Mobile app shows Clerk sign-in UI
- [ ] User can sign up/sign in successfully
- [ ] API logs show successful token verification
- [ ] User record created in database with Clerk user ID
- [ ] API endpoints return user-specific data

---

## 🔒 Security Reminders

### ⚠️ Important Security Notes

1. **Never commit `.env` files** - They contain secret keys
2. **Verify `.gitignore`** includes:
   ```
   .env
   .env.local
   .env.*.local
   ```
3. **Use test keys for development** - Your keys start with `pk_test_` and `sk_test_` (good!)
4. **Rotate keys if exposed** - If keys are committed, rotate them in Clerk dashboard
5. **Use production keys only in production** - Keys starting with `pk_live_` and `sk_live_`

---

## 📋 Next Steps After Authentication Works

Once authentication is verified:

1. **Test protected endpoints** - Verify `/me/*` endpoints require auth
2. **Test user isolation** - Create sessions, verify they're user-specific
3. **Test entitlements** - Check `/me/entitlement` returns correct user data
4. **Move to database migration** - Once auth works, migrate to Postgres

---

## 📚 Reference

- **Clerk Dashboard**: https://dashboard.clerk.com
- **API Integration**: `apps/api/src/lib/clerk.ts`
- **Mobile Integration**: `apps/mobile/src/lib/auth.ts`
- **Production Readiness**: `MD_DOCS/PRODUCTION_READINESS_DEEP_DIVE.md`

---

**Last Updated**: January 2025

