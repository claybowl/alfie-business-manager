# Vercel Deployment Setup for Alfie

## Configure Supabase on Vercel

Your app already has Supabase integration with a cloud sync button. To enable it on your deployed Vercel site:

### Step 1: Get Your Supabase Credentials

1. Go to your Supabase project at https://supabase.com
2. Click on **Settings** → **API**
3. Copy these values:
   - **Project URL** (looks like: `https://xxxxx.supabase.co`)
   - **anon/public key** (starts with `eyJ...`)

### Step 2: Add Environment Variables to Vercel

1. Go to your Vercel project dashboard
2. Navigate to **Settings** → **Environment Variables**
3. Add these variables:

| Name | Value |
|------|-------|
| `VITE_SUPABASE_URL` | Your Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Your Supabase anon key |

**Important:** Make sure to set these for all environments (Production, Preview, Development)

### Step 3: Redeploy

After adding the environment variables:
1. Go to **Deployments** tab
2. Click the **...** menu on your latest deployment
3. Select **Redeploy**
4. Check "Use existing Build Cache" for faster deployment

### Step 4: Verify It Works

1. Visit your deployed site
2. Go to the **Briefing** tab
3. Look for the **☁️ UPLOAD** button in the header
4. Click it to sync your data to Supabase
5. Button should change to **✓ SYNCED**

## What the Cloud Sync Does

- **Saves briefing data** to Supabase for persistence
- **Stores conversation history** in the cloud
- **Enables offline mode** - app works even when backend is down
- **Cross-device sync** - access your data from any device

## Testing Locally

To test locally with your Supabase:

1. Create `.env.local` in project root:
```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

2. Restart your dev server:
```bash
npm run dev
```

3. The cloud sync button will now work locally too!

## Troubleshooting

### "✗ FAILED" when clicking upload
- Check browser console for errors
- Verify environment variables are set correctly on Vercel
- Ensure database tables are created (run migrations)

### No data showing on deployed site
- Make sure you've clicked "☁️ UPLOAD" at least once to sync data
- Check that environment variables include the `VITE_` prefix
- Verify Supabase project is active

### Button shows "Supabase not configured"
- Environment variables are missing or incorrect
- Redeploy after adding variables
- Check Vercel deployment logs for errors

## Current Status

✅ Cloud sync button UI implemented  
✅ Supabase client configured  
✅ Upload/download functions ready  
⏳ **Need to configure Vercel environment variables**  
⏳ **Need to run database migrations (if not done)**  

## Database Setup (One-Time)

If you haven't created the Supabase tables yet:

1. Go to Supabase SQL Editor
2. Open `migrations/001_initial_schema.sql` from your repo
3. Copy the entire SQL script
4. Paste and run in Supabase SQL Editor
5. Verify tables created: `briefing_snapshots`, `conversations`, `conversation_messages`, `sync_metadata`

