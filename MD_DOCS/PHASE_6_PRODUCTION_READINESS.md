# Phase 6: Production Readiness Implementation Plan

**Created**: January 2025  
**Status**: In Progress  
**Goal**: Prepare Entrain for production deployment

---

## Overview

Phase 6 covers four critical areas needed for production:
1. **Authentication** - Replace mock user system with real auth
2. **Database Migration** - Move from SQLite to Postgres
3. **Payments** - Integrate subscription system
4. **Cloud Storage** - Move audio files to S3/CDN

---

## Phase 6.1: Authentication

### Current State
- All endpoints use hardcoded `DEFAULT_USER_ID = "00000000-0000-0000-0000-000000000000"`
- No authentication middleware
- No user identity verification
- 16 instances of `DEFAULT_USER_ID` throughout codebase

### Implementation Approach

**Option A: Clerk (Recommended)**
- ✅ Easy integration with React Native
- ✅ Built-in UI components
- ✅ Social auth + email/password
- ✅ Session management
- ✅ Free tier: 10,000 MAU

**Option B: Supabase Auth**
- ✅ Open source
- ✅ Integrated with Supabase (if using for database)
- ✅ Self-hostable
- ⚠️ Requires more setup

**Decision**: Start with Clerk for faster implementation. Can migrate to Supabase later if needed.

### Tasks
1. Install Clerk SDK (`@clerk/clerk-expo`)
2. Create authentication middleware for Hono
3. Create `getUserId()` helper function to extract user ID from token
4. Replace all `DEFAULT_USER_ID` references with authenticated user ID
5. Add auth error handling
6. Update mobile app to use Clerk authentication
7. Secure all `/me/*` endpoints

---

## Phase 6.2: Database Migration

### Current State
- SQLite database (local file)
- Prisma schema configured for SQLite
- Database file: `apps/api/prisma/dev.db`

### Implementation Approach

**Option A: Supabase Postgres**
- ✅ Managed Postgres database
- ✅ Integrated auth (if using Supabase Auth)
- ✅ Free tier: 500MB database
- ✅ Built-in connection pooling

**Option B: Neon Postgres**
- ✅ Serverless Postgres
- ✅ Better for scaling
- ✅ Free tier: 0.5GB storage
- ⚠️ More setup required

**Decision**: Use Supabase Postgres for simplicity and integration with auth if needed.

### Tasks
1. Create Supabase project and database
2. Update `DATABASE_URL` in environment variables
3. Update Prisma schema for Postgres (mostly compatible, but check)
4. Create migration script to transfer data from SQLite → Postgres
5. Test migration with sample data
6. Update connection pooling settings
7. Add database backup strategy

---

## Phase 6.3: Payments

### Current State
- Mock entitlement system (everyone is "free")
- `getEntitlement()` function exists but only checks daily limits
- No payment/subscription integration

### Implementation Approach

**RevenueCat Integration**
- ✅ Cross-platform (iOS + Android)
- ✅ Handles App Store and Play Store subscriptions
- ✅ Webhook support for server-side validation
- ✅ Free tier: $0-10k MRR

### Subscription Tiers

**Free Tier** (Current):
- 2 sessions per day
- Infinite session length
- All voices
- Catalog sessions only

**Pro Tier** (New):
- Unlimited sessions
- Custom affirmations (generated)
- All voices
- Manifestation tools (future)
- Offline downloads (future)

### Tasks
1. Set up RevenueCat project
2. Configure products in App Store Connect / Play Console
3. Install RevenueCat SDK (`react-native-purchases`)
4. Create subscription management hooks
5. Update `getEntitlement()` to check RevenueCat subscriptions
6. Add webhook endpoint to handle subscription events
7. Update UI to show subscription status and upgrade prompts
8. Test subscription flow end-to-end

---

## Phase 6.4: Cloud Storage

### Current State
- Audio files stored locally in `apps/api/storage/`
- Audio files served via local file system
- URLs are local paths or localhost URLs
- No CDN or cloud storage

### Implementation Approach

**AWS S3 + CloudFront**
- ✅ Industry standard
- ✅ Scalable
- ✅ CloudFront CDN for fast global delivery
- ✅ Versioning and lifecycle policies
- ⚠️ Requires AWS account setup

### Tasks
1. Set up AWS S3 bucket for audio storage
2. Configure CloudFront distribution
3. Set up IAM roles and policies
4. Create service to upload audio files to S3
5. Update audio generation pipeline to upload to S3
6. Update audio URL construction to use CloudFront URLs
7. Add environment variable for CDN base URL
8. Test upload and playback with CDN URLs
9. Set up lifecycle policies for old audio files

---

## Implementation Order

1. **Phase 6.1: Authentication** (Foundation for everything else)
2. **Phase 6.2: Database Migration** (Can be done in parallel with auth)
3. **Phase 6.4: Cloud Storage** (Independent, can be done anytime)
4. **Phase 6.3: Payments** (Requires auth, can be done after)

---

## Environment Variables Needed

```bash
# Authentication
CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=

# Database
DATABASE_URL=postgresql://user:password@host:5432/database

# Payments
REVENUECAT_API_KEY=

# Cloud Storage
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_S3_BUCKET_NAME=
AWS_REGION=
CLOUDFRONT_DOMAIN=
```

---

## Success Criteria

- [ ] All endpoints require authentication
- [ ] Database migrated to Postgres with zero data loss
- [ ] Subscription system working end-to-end
- [ ] Audio files served via CDN with proper URLs
- [ ] All environment variables documented
- [ ] Production deployment guide created

