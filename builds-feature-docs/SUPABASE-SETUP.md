# Supabase Setup Guide

Step-by-step guide to set up both PROD and DEV Supabase environments from scratch, up to the point where implementation can begin.

## Prerequisites

- [Supabase](https://supabase.com/) account (free tier)
- [Discord Developer Portal](https://discord.com/developers/applications) account
- Node.js 18+ (for the seed script)
- The project cloned locally with `npm install` completed

## Step 1: Create Two Supabase Projects

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard) and create two projects:
   - **PROD**: `d2r-esr-runeword-browser` (or your preferred name)
   - **DEV**: `d2r-esr-runeword-browser-dev`
2. Choose the same region for both (e.g., `eu-central-1` for EU, or `us-east-1` for US). Note the region — it goes in the privacy policy.
3. Set a strong database password for each. Save these passwords somewhere safe — they're needed for direct database access (not for the app).
4. Wait for both projects to finish provisioning.

### Collect Project Credentials

For each project, go to **Settings → API** and note:
- **Project URL** (e.g., `https://xxxxx.supabase.co`)
- **Anon key** (public, safe for client-side)
- **Service role key** (secret, only for the seed script — never commit this)

## Step 2: Configure Discord OAuth (Both Environments)

You need **two separate Discord apps** — one for PROD, one for DEV.

### Create Discord Apps

1. Go to [discord.com/developers/applications](https://discord.com/developers/applications)
2. Click **"New Application"** and create:
   - `D2R ESR Runeword Browser` (for PROD)
   - `D2R ESR Runeword Browser DEV` (for DEV)
3. For each app, go to **OAuth2** in the left sidebar
4. Note the **Client ID** and **Client Secret**

### Configure Redirect URLs

For each Discord app, under **OAuth2 → Redirects**, add the Supabase auth callback URL:

**PROD Discord app:**
```
https://[PROD_PROJECT_REF].supabase.co/auth/v1/callback
```

**DEV Discord app:**
```
https://[DEV_PROJECT_REF].supabase.co/auth/v1/callback
```

Replace `[PROJECT_REF]` with the project reference from your Supabase project URL (the subdomain part).

### Enable Discord in Supabase

For each Supabase project:

1. Go to **Authentication → Providers → Discord**
2. Toggle **Enable Discord provider**
3. Paste the **Client ID** and **Client Secret** from the corresponding Discord app
4. Save

## Step 3: Configure Email Magic Link (Both Environments)

For each Supabase project:

1. Go to **Authentication → Providers → Email**
2. Ensure **Enable Email provider** is on
3. Ensure **Enable Email Confirmations** is on (magic link flow)
4. Leave **Double Confirm email changes** on

### (Optional) Custom SMTP

Supabase's default email sender has low deliverability and rate limits (4 emails/hour on free tier). For better magic link delivery:

1. Sign up for a free SMTP service (e.g., [Resend](https://resend.com/) — 3,000 emails/month free, or [Brevo](https://www.brevo.com/) — 300 emails/day free)
2. Go to **Settings → Auth → SMTP Settings** in Supabase
3. Toggle **Enable Custom SMTP**
4. Enter the SMTP credentials from your provider

This is optional for DEV (you can test with Supabase's built-in sender). Recommended for PROD to avoid magic link emails landing in spam.

## Step 4: Configure Auth Settings

For each Supabase project:

1. Go to **Authentication → URL Configuration**
2. Set **Site URL**:
   - PROD: `https://your-production-domain.com` (e.g., your GitHub Pages URL)
   - DEV: `http://localhost:5173` (Vite default dev server)
3. Add **Redirect URLs** (allowed post-auth redirects):
   - PROD: `https://your-production-domain.com/**`
   - DEV: `http://localhost:5173/**`

## Step 5: Run Database Migrations

### Apply the Initial Migration

1. Open the file `supabase/migrations/001_initial_schema.sql` from the repository (this file is created as the first implementation task, assembled from the SQL in `FEATURE-BUILD-SHARING.md` — triggers, table creation, RLS policies, and functions)
2. For each Supabase project (PROD and DEV):
   - Go to **SQL Editor** in the Supabase dashboard
   - Click **"New query"**
   - Paste the entire contents of `001_initial_schema.sql`
   - Click **"Run"**
   - Verify no errors in the output

### Verify Tables

After running the migration, check that these tables exist under **Table Editor**:
- `profiles`
- `builds`
- `likes`

And under **Database → Functions**, verify these functions exist:
- `handle_new_user`
- `handle_likes_change`

### Apply the Favourites Migration (002)

Adds Supabase-backed item favourites (runewords / gemwords / uniques) and a public per-item favourite count.

1. Open `supabase/migrations/002_favorites.sql`.
2. For each Supabase project (DEV first, then PROD): **SQL Editor → New query → paste → Run**, and verify no errors.

After running, verify under **Table Editor**:
- `favorites`
- `favorite_counts`

And under **Database → Functions**:
- `handle_favorites_change`

### Future Migrations

When new migration files are added to `supabase/migrations/`:
1. Apply to DEV first, test the feature
2. Then apply to PROD before deploying the corresponding code change
3. Always run migrations in order (don't skip numbers)

## Step 6: Configure Vite Environment Variables

### Create `.env.development`

In the project root, create `.env.development`:

```
VITE_SUPABASE_URL=https://[DEV_PROJECT_REF].supabase.co
VITE_SUPABASE_ANON_KEY=[DEV_ANON_KEY]
```

### Create `.env.production`

In the project root, create `.env.production`:

```
VITE_SUPABASE_URL=https://[PROD_PROJECT_REF].supabase.co
VITE_SUPABASE_ANON_KEY=[PROD_ANON_KEY]
```

### Create `.env.local` (for seed script only)

In the project root, create `.env.local`:

```
# Used by scripts/seed-dev-from-prod.ts — never exposed to the browser
DEV_SUPABASE_URL=https://[DEV_PROJECT_REF].supabase.co
DEV_SUPABASE_SERVICE_ROLE_KEY=[DEV_SERVICE_ROLE_KEY]
PROD_SUPABASE_URL=https://[PROD_PROJECT_REF].supabase.co
PROD_SUPABASE_ANON_KEY=[PROD_ANON_KEY]
```

**Security note:** `.env.local` is already gitignored by the `*.local` pattern in `.gitignore`. The service role key must never be committed or exposed to the browser.

### Which files are committed?

| File | Committed | Why |
|------|-----------|-----|
| `.env.development` | Yes | Contains only public anon key (safe, exposed in browser bundle anyway) |
| `.env.production` | Yes | Same — public anon key only |
| `.env.local` | No (gitignored) | Contains service role key (secret) |

## Step 7: Verify Setup

### Test the Supabase Connection

1. Run `npm run dev`
2. Open the browser console — the Supabase client should initialize without errors
3. If `VITE_SUPABASE_URL` is set, the "Builds" nav item and "Sign In" button should appear

### Test Discord OAuth (DEV)

1. Click "Sign In" → "Sign in with Discord"
2. You should be redirected to Discord's authorization page
3. After authorizing, you should be redirected back to `localhost:5173`
4. A `profiles` row should be created automatically (check in Supabase Table Editor)
5. The post-registration consent gate should appear (first login)

### Test Email Magic Link (DEV)

1. Click "Sign In" → enter your email
2. Check your inbox (or Supabase Authentication → Users to see the magic link if using default sender)
3. Click the magic link — you should be redirected back and logged in
4. A `profiles` row should be created with display name "Adventurer"

### Test RLS Policies

1. While logged in, try creating a build — should succeed
2. Try accessing another user's profile — should be readable
3. Check the Supabase SQL editor: `SELECT * FROM profiles;` should return all profiles
4. Check RLS is active: Table Editor should show the lock icon on all three tables

## Step 8: Seed DEV with Test Data (Optional)

Once PROD has some real builds, you can seed DEV with realistic test data:

```bash
npx tsx scripts/seed-dev-from-prod.ts
```

This will:
- Read all builds from PROD (read-only, using anon key)
- Create test users in DEV (`testuser1@example.com`, `testuser2@example.com`, etc.)
- Copy builds to DEV, assigned to test users
- Generate random likes

**When to use this:**
- Before developing a new feature that needs realistic data
- After a major schema migration to verify data integrity
- To test pagination, sorting, and filtering with real build content

## Troubleshooting

### "Supabase unreachable" after inactivity

Free tier projects pause after 7 days of inactivity. They auto-resume on the first request (~1-2 minutes). Just wait and refresh.

### Discord OAuth redirect error

- Check that the redirect URL in the Discord app matches exactly: `https://[PROJECT_REF].supabase.co/auth/v1/callback`
- Ensure the correct Client ID/Secret is pasted in the matching Supabase project (don't mix PROD and DEV)

### Magic link email not received

- Check spam folder
- Check Supabase Authentication → Users — the user should appear even if the email wasn't received
- Consider setting up custom SMTP (Step 3)

### Migration errors

- If a migration fails partway through, you may need to drop the created objects manually before re-running
- Check the Supabase SQL editor output for specific error messages
- Ensure you're running migrations in order

### `.env` not loading

- Vite only loads `.env.development` when running `npm run dev` (development mode)
- Vite only loads `.env.production` when running `npm run build` (production mode)
- Changes to `.env` files require restarting the dev server
- Env vars must be prefixed with `VITE_` to be accessible in client code
