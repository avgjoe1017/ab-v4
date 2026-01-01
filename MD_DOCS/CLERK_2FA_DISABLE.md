# Disable 2FA in Clerk for Development

**Issue**: Sign-in shows `needs_second_factor` status, requiring 2FA authentication.

**Solution**: Disable 2FA in Clerk dashboard for development.

---

## Steps to Disable 2FA

1. **Go to Clerk Dashboard**: https://dashboard.clerk.com
2. **Navigate to**: Your Application → **Settings** → **Multi-factor authentication**
3. **Disable 2FA**:
   - Turn off "Require multi-factor authentication"
   - Or set it to "Optional" instead of "Required"
4. **Save changes**

---

## Alternative: Implement 2FA Flow

If you want to keep 2FA enabled, you'll need to implement the 2FA verification flow in the sign-in screen:

```typescript
if (result.status === "needs_second_factor") {
  // Show 2FA code input
  // Call signIn.attemptSecondFactor({ strategy: "totp", code })
}
```

For now, **disabling 2FA is recommended for development**.

---

**Last Updated**: January 2025

