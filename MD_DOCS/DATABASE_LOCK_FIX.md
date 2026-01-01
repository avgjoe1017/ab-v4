# Fixing SQLite "Database is Locked" Error

## Quick Fix

**Step 1: Stop any running API servers**
- Close any terminal windows running `pnpm -C apps/api dev` or `bun src/index.ts`
- Or kill the process: `Get-Process | Where-Object {$_.ProcessName -like "*bun*" -or $_.ProcessName -like "*node*"} | Stop-Process`

**Step 2: Delete the lock file** (if it exists)
```powershell
cd apps\api\prisma\prisma
Remove-Item dev.db-journal -ErrorAction SilentlyContinue
```

**Step 3: Retry the migration**
```powershell
cd apps\api
pnpm prisma:migrate
```

## Alternative: Use Prisma Reset (WARNING: Deletes all data)

If you don't have important data and want a clean start:
```powershell
cd apps\api
pnpm prisma migrate reset
```
This will:
- Drop the database
- Create a new database
- Run all migrations
- Run the seed

## Prevention

Always stop the API server before running migrations or seed operations.

