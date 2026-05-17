# Task Tabber — Setup Guide

## 1. Create a Supabase project

1. Go to https://supabase.com and create a new project
2. Once provisioned, open **SQL Editor** and run the contents of `schema.sql`
3. Go to **Settings → API** and copy:
   - **Project URL** → paste as `SUPABASE_URL` in `config.js`
   - **anon / public key** → paste as `SUPABASE_ANON_KEY` in `config.js`

## 2. Enable Google OAuth

### In Google Cloud Console
1. Go to https://console.cloud.google.com
2. Create a project (or use an existing one)
3. **APIs & Services → OAuth consent screen** — configure, add your email as test user
4. **APIs & Services → Credentials → Create credentials → OAuth 2.0 Client ID**
   - Application type: **Web application**
   - Authorised redirect URI: `https://<your-project-ref>.supabase.co/auth/v1/callback`
     (find this in Supabase → Auth → Providers → Google)
5. Copy the **Client ID** and **Client secret**

### In Supabase
1. **Authentication → Providers → Google** → enable it
2. Paste the Client ID and Client secret
3. Save

## 3. Deploy the web app

Any static host works — Vercel, Netlify, GitHub Pages, Cloudflare Pages.
The app is plain HTML/CSS/JS — no build step needed.

**Vercel (quickest):**
```
npm i -g vercel
cd "B:/claude code/pixel-tasks"
vercel
```
Add `SUPABASE_URL` and `SUPABASE_ANON_KEY` as env vars in the Vercel dashboard,
or keep them in `config.js` (do not commit `config.js` to a public repo).

Back in Supabase → Auth → URL Configuration:
- **Site URL**: your deployed URL
- **Redirect URLs**: your deployed URL + `/*`

## 4. iOS app setup

See `../task-tabber-app/.env.example` — fill in the same Supabase credentials.

```
cd "../task-tabber-app"
npm install
npx expo start
```

Scan the QR code with **Expo Go** on your iPhone to test instantly.
For a production build: `npx eas build --platform ios`
