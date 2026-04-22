# Mission Control — Deploy Guide

## What you have
A fully working PWA (Progressive Web App) — no build step, no Node.js needed.
Deploy once, open on your phone, install to home screen, get notifications.

---

## Step 1 — Upload to GitHub (free, 5 min)

1. Go to https://github.com and sign in (or create a free account)
2. Click **+ New repository**
   - Name: `mission-control`
   - Set to **Public**
   - Click **Create repository**
3. On the next page click **"uploading an existing file"**
4. Drag and drop ALL files from this folder:
   - `index.html`
   - `manifest.json`
   - `sw.js`
   - `vercel.json`
   - `icon-192.png`
   - `icon-512.png`
5. Click **Commit changes**

---

## Step 2 — Deploy to Vercel (free, 2 min)

1. Go to https://vercel.com and sign in with your GitHub account
2. Click **"Add New Project"**
3. Find your `mission-control` repo and click **Import**
4. Leave all settings as default — click **Deploy**
5. In ~30 seconds you'll get a live URL like:
   `https://mission-control-abc123.vercel.app`

That's it. Your app is live.

---

## Step 3 — Install on your phone (home screen icon)

### iPhone / iOS
1. Open your Vercel URL in **Safari** (must be Safari, not Chrome)
2. Tap the **Share button** (box with arrow at the bottom)
3. Scroll down and tap **"Add to Home Screen"**
4. Tap **"Add"** — you'll see the Mission Control icon on your home screen

### Android
1. Open your Vercel URL in **Chrome**
2. Tap the **three-dot menu** (top right)
3. Tap **"Add to Home Screen"** or **"Install App"**
4. Tap **"Install"**

---

## Step 4 — Enable notifications

1. Open the app from your home screen icon
2. Tap the **ALERTS** tab (🔔)
3. Tap **"ENABLE NOTIFICATIONS"**
4. Allow when your phone asks

You'll now get reminders at:
- 07:30 — Morning check-in
- 12:30 — Lunch reminder
- 17:00 — Workout time
- 20:00 — Evening log
- 15:00 — Water reminder (off by default, toggle on in ALERTS tab)

---

## Notes

- **Data is stored on your device** (localStorage) — private, no account needed
- **Free forever** — Vercel's free tier is more than enough for a personal app
- **Updates**: To update the app, just re-upload changed files to GitHub — Vercel redeploys automatically
- **iOS notification limitation**: iOS requires the app to be installed (Step 3) for background notifications. Notifications work best when opened from the home screen icon, not the browser.

---

## Custom domain (optional)

In Vercel → your project → Settings → Domains, you can add a custom domain like `myapp.com` if you own one. Otherwise the `.vercel.app` URL works perfectly.
