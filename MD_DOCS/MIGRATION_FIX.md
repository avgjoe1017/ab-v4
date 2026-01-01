# Fixing Stuck Migration - Database Locked

## The Problem
The migration `20251213064853_init` exists but can't be applied because the database is locked.

## Solution Options

### Option 1: Reset Database (Recommended if no important data)
This will drop and recreate the database, then apply all migrations and run seed:

```powershell
cd apps\api
pnpm prisma migrate reset
```

**WARNING**: This deletes all data in the database!

### Option 2: Force Unlock and Retry
1. Make sure no API server is running
2. Close all terminals that might have accessed the database
3. Delete the journal file:
   ```powershell
   cd apps\api\prisma\prisma
   Remove-Item dev.db-journal -ErrorAction SilentlyContinue
   ```
4. Try migration again:
   ```powershell
   cd apps\api
   pnpm prisma:migrate
   ```

### Option 3: Manual Migration (Advanced)
If the above don't work, you can manually apply the migration:

1. Open the database with a SQLite tool
2. Run the SQL from `prisma/migrations/20251213064853_init/migration.sql`
3. Mark migration as applied:
   ```powershell
   cd apps\api
   pnpm prisma migrate resolve --applied 20251213064853_init
   ```

## Recommended: Use Reset
Since this is development and you likely don't have important data yet, use `prisma migrate reset` - it's the cleanest solution and will also run the seed automatically.

