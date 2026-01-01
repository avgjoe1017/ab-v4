# Admin App Clerk Integration Guide

**Date**: January 2025  
**App**: `apps/admin` (Next.js 15 App Router)  
**Purpose**: Correct Clerk integration following Next.js App Router patterns

---

## Current State

The admin app (`apps/admin`) currently uses:
- Custom login page at `/admin/login`
- Session-based authentication with localStorage tokens
- Custom admin API authentication

**Status**: Clerk not yet integrated

---

## Integration Steps

### 1. Install Clerk Next.js SDK

```bash
cd apps/admin
pnpm add @clerk/nextjs@latest
```

### 2. Set Up Environment Variables

Create or update `apps/admin/.env.local`:

```bash
# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
CLERK_SECRET_KEY=YOUR_SECRET_KEY

# API URL (existing)
NEXT_PUBLIC_API_URL=http://localhost:8787
```

**Important**: 
- Get keys from [Clerk Dashboard → API Keys](https://dashboard.clerk.com/last-active?path=api-keys)
- Use placeholders in code examples, real keys only in `.env.local`
- Verify `.gitignore` excludes `.env.local`

### 3. Create `proxy.ts` File

Create `apps/admin/src/proxy.ts` (or `apps/admin/proxy.ts` if no `src` directory):

```typescript
// apps/admin/src/proxy.ts
import { clerkMiddleware } from "@clerk/nextjs/server";

export default clerkMiddleware();

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
```

**Key Points**:
- Uses `clerkMiddleware()` from `@clerk/nextjs/server` (NOT the deprecated `authMiddleware()`)
- Placed in `src/` directory if present, otherwise at root
- Matcher config ensures Clerk runs on all routes except static files

### 4. Update Root Layout

Update `apps/admin/src/app/layout.tsx`:

```typescript
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { ClerkProvider } from '@clerk/nextjs';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Affirmation Beats Admin',
  description: 'Admin dashboard for Affirmation Beats',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body className={inter.className}>{children}</body>
      </html>
    </ClerkProvider>
  );
}
```

**Key Points**:
- Wrap entire app with `<ClerkProvider>`
- Import from `@clerk/nextjs` (not deprecated packages)

### 5. Update Login Page

Replace `apps/admin/src/app/admin/login/page.tsx` with Clerk components:

```typescript
'use client';

import { SignIn } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from '@clerk/nextjs';

export default function LoginPage() {
  const { isSignedIn } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isSignedIn) {
      router.push('/admin/dashboard');
    }
  }, [isSignedIn, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full">
        <SignIn 
          routing="path"
          path="/admin/login"
          signUpUrl="/admin/sign-up"
          afterSignInUrl="/admin/dashboard"
        />
      </div>
    </div>
  );
}
```

**Alternative**: Use Clerk's built-in components:

```typescript
'use client';

import { SignInButton, SignedIn, SignedOut, UserButton } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Affirmation Beats Admin
          </h2>
        </div>
        <SignedOut>
          <SignInButton mode="modal">
            <button className="w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700">
              Sign In
            </button>
          </SignInButton>
        </SignedOut>
        <SignedIn>
          <div className="text-center">
            <p className="text-sm text-gray-600 mb-4">You are signed in</p>
            <UserButton />
            <button
              onClick={() => router.push('/admin/dashboard')}
              className="mt-4 w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
            >
              Go to Dashboard
            </button>
          </div>
        </SignedIn>
      </div>
    </div>
  );
}
```

### 6. Protect Admin Routes

Create middleware to protect admin routes. Update `apps/admin/src/proxy.ts`:

```typescript
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isAdminRoute = createRouteMatcher(['/admin(.*)']);

export default clerkMiddleware(async (auth, req) => {
  // Protect all /admin routes
  if (isAdminRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
```

### 7. Update API Client to Use Clerk Token

Update `apps/admin/src/lib/api.ts` to include Clerk token:

```typescript
import { auth } from '@clerk/nextjs/server';

// ... existing code ...

async function getAuthHeaders(): Promise<HeadersInit> {
  const { getToken } = await auth();
  const token = await getToken();
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  return headers;
}

// Update API calls to use getAuthHeaders()
export const adminApi = {
  // ... existing methods ...
  async login(email: string, password: string) {
    // Remove this - Clerk handles authentication
    throw new Error('Use Clerk authentication instead');
  },
  
  // Update other methods to use Clerk token
  async getSessions() {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_URL}/admin/sessions`, { headers });
    // ... rest of implementation
  },
};
```

### 8. Update AdminLayout Component

Update `apps/admin/src/components/AdminLayout.tsx` to show Clerk user:

```typescript
'use client';

import { SignedIn, SignedOut, UserButton, SignInButton } from '@clerk/nextjs';
import { usePathname } from 'next/navigation';

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  
  // Don't show layout on login page
  if (pathname === '/admin/login') {
    return <>{children}</>;
  }

  return (
    <SignedIn>
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-4">
              <h1 className="text-2xl font-bold">Admin Dashboard</h1>
              <UserButton />
            </div>
          </div>
        </header>
        <main>{children}</main>
      </div>
    </SignedIn>
  );
}
```

---

## Server-Side Authentication

For server components, use `auth()` from `@clerk/nextjs/server`:

```typescript
// apps/admin/src/app/admin/dashboard/page.tsx
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';

export default async function DashboardPage() {
  const { userId } = await auth();
  
  if (!userId) {
    redirect('/admin/login');
  }
  
  // Fetch data using userId
  // ...
}
```

**Key Points**:
- Use `await auth()` in server components (it's async)
- Import from `@clerk/nextjs/server` (not client package)
- Use `redirect()` from `next/navigation` for server-side redirects

---

## Client-Side Authentication

For client components, use hooks from `@clerk/nextjs`:

```typescript
'use client';

import { useAuth, useUser } from '@clerk/nextjs';

export function ClientComponent() {
  const { userId, isSignedIn } = useAuth();
  const { user } = useUser();
  
  if (!isSignedIn) {
    return <div>Please sign in</div>;
  }
  
  return <div>Welcome, {user?.emailAddresses[0]?.emailAddress}</div>;
}
```

---

## Common Patterns

### Protected Route Pattern

```typescript
// apps/admin/src/app/admin/dashboard/page.tsx
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';

export default async function ProtectedPage() {
  const { userId } = await auth();
  
  if (!userId) {
    redirect('/admin/login');
  }
  
  return <div>Protected content</div>;
}
```

### Client-Side Auth Check

```typescript
'use client';

import { useAuth } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export function ProtectedClientComponent() {
  const { isSignedIn, isLoaded } = useAuth();
  const router = useRouter();
  
  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      router.push('/admin/login');
    }
  }, [isLoaded, isSignedIn, router]);
  
  if (!isLoaded || !isSignedIn) {
    return <div>Loading...</div>;
  }
  
  return <div>Protected content</div>;
}
```

---

## Migration from Custom Auth

### Step 1: Keep Both Systems Temporarily

Run both authentication systems in parallel during migration:

```typescript
// Check both Clerk and custom auth
const { userId: clerkUserId } = await auth();
const customToken = localStorage.getItem('admin_token');

if (clerkUserId) {
  // Use Clerk
} else if (customToken) {
  // Fall back to custom auth temporarily
}
```

### Step 2: Migrate Admin Users to Clerk

1. Export existing admin users from database
2. Create corresponding Clerk users (via API or dashboard)
3. Map Clerk user IDs to admin roles in your database

### Step 3: Remove Custom Auth

Once all users are migrated:
1. Remove custom login page
2. Remove custom auth API endpoints
3. Update all API calls to use Clerk tokens
4. Remove localStorage token storage

---

## Integration with API Server

The API server (`apps/api`) already has Clerk integration support:

- `apps/api/src/lib/clerk.ts` - Clerk token verification
- `apps/api/src/lib/auth.ts` - Uses Clerk when configured
- `apps/api/src/middleware/auth.ts` - Auth middleware

**To connect admin app to API**:

1. Admin app gets Clerk token via `auth()` or `useAuth()`
2. Include token in API requests: `Authorization: Bearer <token>`
3. API verifies token using `verifyClerkToken()` from `apps/api/src/lib/clerk.ts`
4. API extracts user ID and checks admin role

**Example API call from admin app**:

```typescript
import { auth } from '@clerk/nextjs/server';

export async function getAdminData() {
  const { getToken } = await auth();
  const token = await getToken();
  
  const res = await fetch(`${API_URL}/admin/dashboard/stats`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  
  return res.json();
}
```

---

## Verification Checklist

Before considering Clerk integration complete:

- [ ] `@clerk/nextjs@latest` installed
- [ ] `proxy.ts` created with `clerkMiddleware()`
- [ ] `<ClerkProvider>` wraps app in `layout.tsx`
- [ ] Environment variables set in `.env.local`
- [ ] Login page uses Clerk components
- [ ] Admin routes protected with middleware
- [ ] API calls include Clerk token
- [ ] Server components use `auth()` from `@clerk/nextjs/server`
- [ ] Client components use hooks from `@clerk/nextjs`
- [ ] No references to deprecated `authMiddleware()` or `_app.tsx`
- [ ] No real keys in tracked files (only placeholders)

---

## Common Mistakes to Avoid

### ❌ Don't Use Deprecated Patterns

```typescript
// ❌ WRONG - Deprecated
import { authMiddleware } from "@clerk/nextjs";

// ✅ CORRECT
import { clerkMiddleware } from "@clerk/nextjs/server";
```

### ❌ Don't Use Pages Router Patterns

```typescript
// ❌ WRONG - Pages Router
// pages/_app.tsx
function MyApp({ Component, pageProps }) {
  return <ClerkProvider>...</ClerkProvider>;
}

// ✅ CORRECT - App Router
// app/layout.tsx
export default function RootLayout({ children }) {
  return (
    <ClerkProvider>
      {children}
    </ClerkProvider>
  );
}
```

### ❌ Don't Store Real Keys in Code

```typescript
// ❌ WRONG
const CLERK_KEY = "pk_live_abc123...";

// ✅ CORRECT
const CLERK_KEY = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
```

---

## Next Steps

1. **Install Clerk SDK**: `pnpm add @clerk/nextjs@latest`
2. **Set up environment variables** in `.env.local`
3. **Create `proxy.ts`** with `clerkMiddleware()`
4. **Update `layout.tsx`** with `<ClerkProvider>`
5. **Replace login page** with Clerk components
6. **Protect admin routes** with middleware
7. **Update API client** to use Clerk tokens
8. **Test authentication flow** end-to-end
9. **Migrate existing admin users** to Clerk
10. **Remove custom auth system**

---

## Resources

- [Clerk Next.js Quickstart](https://clerk.com/docs/nextjs/getting-started/quickstart)
- [Clerk App Router Guide](https://clerk.com/docs/nextjs/app-router)
- [Clerk API Reference](https://clerk.com/docs/reference/nextjs/overview)

---

**Last Updated**: January 2025

