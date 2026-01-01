# Production Deployment Instructions

**Last Updated**: January 2025  
**Status**: In Progress - Phase 6 Implementation

> **📋 For a comprehensive production readiness analysis, see**: `MD_DOCS/PRODUCTION_READINESS_DEEP_DIVE.md`

---

## Phase 6: Production Readiness Checklist

### Phase 6.1: Authentication ✅ Structure Ready

**Status**: Foundation implemented, ready for Clerk integration

**What's Done**:
- ✅ Created `apps/api/src/lib/auth.ts` with `getUserId()` helper
- ✅ Created `apps/api/src/middleware/auth.ts` with authentication middleware
- ✅ Structured code to easily replace default user ID with real auth

**What's Needed**:
- [ ] Install Clerk backend SDK: `pnpm add @clerk/backend`
- [ ] Set up Clerk account and create application
- [ ] Add environment variables:
  ```bash
  CLERK_PUBLISHABLE_KEY=pk_...
  CLERK_SECRET_KEY=sk_...
  ```
- [ ] Update `getUserId()` in `apps/api/src/lib/auth.ts` to verify Clerk tokens
- [ ] Replace all `DEFAULT_USER_ID` references with `getUserId(c)`
- [ ] Add `requireAuthMiddleware` to all `/me/*` endpoints
- [ ] Install Clerk in mobile app: `pnpm add @clerk/clerk-expo`
- [ ] Set up Clerk provider in mobile app
- [ ] Update API calls to include Authorization header with Clerk token

**Files to Update**:
- `apps/api/src/index.ts` - Replace DEFAULT_USER_ID in all endpoints (16 instances)
- `apps/api/src/lib/auth.ts` - Implement Clerk token verification
- `apps/mobile/src/App.tsx` - Add ClerkProvider
- `apps/mobile/src/lib/api.ts` - Add Authorization header to API calls

---

### Phase 6.2: Database Migration

**Status**: Not Started

**What's Needed**:
- [ ] Create Supabase project and Postgres database
- [ ] Update `DATABASE_URL` environment variable
- [ ] Update Prisma schema if needed (SQLite → Postgres compatibility check)
- [ ] Create data migration script
- [ ] Test migration with sample data
- [ ] Update connection pooling settings
- [ ] Set up database backups

**Migration Script Location**: `apps/api/prisma/migrate-to-postgres.ts` (to be created)

---

### Phase 6.3: Payments (RevenueCat)

**Status**: Not Started

**What's Needed**:
- [ ] Create RevenueCat account and project
- [ ] Configure products in App Store Connect
- [ ] Configure products in Google Play Console
- [ ] Install RevenueCat SDK: `pnpm add react-native-purchases`
- [ ] Set up RevenueCat webhook endpoint
- [ ] Update `getEntitlement()` to check RevenueCat subscriptions
- [ ] Create subscription management UI
- [ ] Test subscription flow end-to-end

**Files to Update**:
- `apps/api/src/services/entitlements.ts` - Add RevenueCat subscription checks
- `apps/mobile/src/hooks/useEntitlement.ts` - Add RevenueCat SDK integration

---

### Phase 6.4: Cloud Storage (S3 + CloudFront)

**Status**: Not Started

**What's Needed**:
- [ ] Create AWS account and S3 bucket
- [ ] Set up CloudFront distribution
- [ ] Configure IAM roles and policies
- [ ] Install AWS SDK: `pnpm add @aws-sdk/client-s3 @aws-sdk/s3-request-presigner`
- [ ] Create S3 upload service
- [ ] Update audio generation to upload to S3
- [ ] Update audio URL construction to use CloudFront URLs
- [ ] Add environment variables:
  ```bash
  AWS_ACCESS_KEY_ID=...
  AWS_SECRET_ACCESS_KEY=...
  AWS_S3_BUCKET_NAME=...
  AWS_REGION=us-east-1
  CLOUDFRONT_DOMAIN=...
  ```
- [ ] Set up lifecycle policies for old audio files

**Files to Update**:
- `apps/api/src/services/audio/generation.ts` - Upload to S3 after generation
- `apps/api/src/services/audio/stitching.ts` - Upload stitched files to S3
- `apps/api/src/index.ts` - Update URL construction for CloudFront

---

## Environment Variables Required

### Development
```bash
# Database
DATABASE_URL="file:./dev.db"

# API
PORT=8787
NODE_ENV=development
```

### Production
```bash
# Authentication
CLERK_PUBLISHABLE_KEY=pk_live_...
CLERK_SECRET_KEY=sk_live_...

# Database
DATABASE_URL=postgresql://user:password@host:5432/database

# Payments
REVENUECAT_API_KEY=...

# Cloud Storage
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_S3_BUCKET_NAME=entrain-audio-prod
AWS_REGION=us-east-1
CLOUDFRONT_DOMAIN=d1234abcdef.cloudfront.net

# API
PORT=8787
NODE_ENV=production
```

---

## Deployment Steps

1. **Set up infrastructure** (Supabase, AWS, RevenueCat, Clerk)
2. **Configure environment variables** in production environment
3. **Run database migrations**: `pnpm -C apps/api prisma migrate deploy`
4. **Build API**: `pnpm -C apps/api build`
5. **Deploy API** (Cloudflare Workers, Vercel, Railway, etc.)
6. **Build mobile app**: `pnpm -C apps/mobile build`
7. **Submit to App Stores** (App Store Connect, Google Play Console)

---

## Testing Checklist

- [ ] Authentication works for all protected endpoints
- [ ] Database migration completed with zero data loss
- [ ] Subscriptions work end-to-end (purchase, renewal, cancellation)
- [ ] Audio files upload to S3 and serve from CloudFront
- [ ] All environment variables are set correctly
- [ ] Error handling works for auth failures
- [ ] Rate limiting works (if implemented)

---

## Rollback Plan

If issues occur in production:

1. **Authentication issues**: Switch back to default user ID temporarily
2. **Database issues**: Restore from backup, rollback migration
3. **Payment issues**: Disable subscription checks, allow all users free tier
4. **Storage issues**: Fall back to local file storage temporarily

---

## Resources

- [Clerk Documentation](https://clerk.com/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [RevenueCat Documentation](https://docs.revenuecat.com)
- [AWS S3 Documentation](https://docs.aws.amazon.com/s3/)
- [CloudFront Documentation](https://docs.aws.amazon.com/cloudfront/)
