# Running Seed to Generate Silence Chunks

After the V3 compliance fixes, you need to run the seed process to pre-generate silence chunks.

## Prerequisites

1. **Run Prisma Migrations** (if not already done):
   ```powershell
   cd apps\api
   pnpm prisma:migrate
   ```
   When prompted for migration name, enter: `init` or `v3_silence_chunks`

2. **Generate Prisma Client**:
   ```powershell
   pnpm prisma:generate
   ```

## Running the Seed

**Option 1: Using Prisma's seed command**
```powershell
cd apps\api
bun prisma db seed
```

**Option 2: Direct execution**
```powershell
cd apps\api
bun prisma\seed.ts
```

**Option 3: Using pnpm (if configured)**
```powershell
cd apps\api
pnpm exec prisma db seed
```

## What the Seed Does

1. **Pre-generates all silence chunks** (V3 compliance):
   - 250ms, 500ms, 1000ms, 1500ms, 2000ms, 3000ms, 5000ms
   - Stores them in `storage/chunks/`
   - Registers them in `AudioAsset` table

2. **Seeds catalog sessions**:
   - Morning Affirmations
   - Sleep & Relax
   - Focus Boost

## Verification

After running seed, you should see:
```
🌱 Starting seed process...
🔇 Pre-generating silence chunks (V3 compliance)...
  Generating silence 250ms...
  ✓ Silence 250ms ready
  Generating silence 500ms...
  ✓ Silence 500ms ready
  ...
✅ All silence chunks pre-generated
🌱 Seeding catalog sessions...
Creating: Morning Affirmations
Creating: Sleep & Relax
Creating: Focus Boost
✅ Seeding complete.
```

## Troubleshooting

**Error: "Table does not exist"**
- Run migrations first: `pnpm prisma:migrate`

**Error: "PrismaClient not found"**
- Generate Prisma client: `pnpm prisma:generate`

**Error: "ffmpeg-static not found"**
- Ensure dependencies are installed: `pnpm install`

