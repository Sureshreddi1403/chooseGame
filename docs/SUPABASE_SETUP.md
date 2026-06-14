# Supabase Setup Guide

I cannot create a Supabase account on your behalf — you must sign up yourself. Follow these steps to set up the shared project for your team.

## 1. Create Supabase Account & Project

1. Go to [https://supabase.com](https://supabase.com) and click **Start your project**
2. Sign up with GitHub or email
3. Click **New Project**
   - **Name:** `multisport-usa`
   - **Database Password:** generate a strong password and save it
   - **Region:** `East US (North Virginia)` (closest to most US users)
4. Wait ~2 minutes for provisioning

## 2. Run Database Migration

1. Open your project dashboard
2. Go to **SQL Editor** → **New query**
3. Copy the entire contents of `supabase/migrations/001_initial_schema.sql`
4. Click **Run**
5. Verify tables under **Table Editor**: `profiles`, `sports`, `venues`, `games`, `bookings`, `trainers`

## 3. Configure Authentication

1. Go to **Authentication** → **Providers**
2. Enable **Email** provider
3. Under **Authentication** → **URL Configuration**:
   - Site URL: `http://localhost:4200` (Angular dev)
   - Redirect URLs: `http://localhost:4200/**`
4. Optional: disable **Confirm email** for development under **Email** settings

## 4. Get API Keys (Share with Team)

1. Go to **Project Settings** → **API**
2. Copy these values into `backend/.env`:

```
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

> **Security:** Never commit `.env` files. Share keys via a password manager (1Password, Bitwarden).

## 5. Multi-User Team Access

1. Go to **Project Settings** → **Team**
2. Click **Invite member**
3. Add team members by email with roles:
   - **Owner** — full access (you)
   - **Administrator** — manage settings, no billing
   - **Developer** — database + API access
   - **Read-only** — view only

All invited members can access the same Supabase project dashboard.

## 6. Verify Email Check Endpoint

The Node.js backend exposes `GET /api/auth/check-email?email=test@example.com` which queries the `profiles` table for duplicate emails during registration.
