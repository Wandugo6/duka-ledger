# Duka Ledger — Setup Guide

This is your sales & stock tracker as a real website that all 5 shops and the warehouse can open from their phones. It needs two free accounts: **Supabase** (the database that keeps everyone's data in sync) and **Vercel** (hosts the actual website).

Follow these steps in order. It takes about 15–20 minutes the first time.

---

## Step 1 — Create your database (Supabase)

1. Go to **https://supabase.com** and click **Start your project**. Sign up (free, no card needed).
2. Click **New project**.
   - Name: `duka-ledger` (or anything you like)
   - Database password: pick a strong one and **save it somewhere** (a notes app, not your head)
   - Region: choose the one closest to Kenya (e.g. Europe or anything labeled close to East Africa)
3. Wait about a minute for the project to finish setting up.
4. In the left sidebar, click the **SQL Editor** icon.
5. Click **New query**.
6. Open the file `supabase-schema.sql` (included in this folder), copy **all** of its contents, and paste it into the SQL editor box.
7. Click **Run** (bottom right). You should see "Success. No rows returned."
   - This creates the three tables the app needs: `sales`, `transfers`, and `settings`.
8. In the left sidebar, click **Project Settings** (gear icon) → **API Keys**.
9. You'll need two values from this page in Step 3:
   - **Project URL** (looks like `https://abcdefgh.supabase.co`)
   - **Publishable key** (starts with `sb_publishable_...`) — if you only see "anon" / "service_role" keys instead, that's fine too, use the **anon** key the same way.

Keep this browser tab open — you'll come back for these two values.

---

## Step 2 — Put the code on GitHub

Vercel deploys from a GitHub repository, so the code needs to live there first.

1. Go to **https://github.com** and sign up if you don't have an account (free).
2. Click the **+** icon (top right) → **New repository**.
   - Name: `duka-ledger`
   - Keep it **Private** (recommended, so the source isn't public)
   - Don't add a README, .gitignore, or license — leave those unchecked
   - Click **Create repository**
3. On the next page, GitHub shows you commands under "…or push an existing repository from the command line." You won't need a command line — instead:
   - Click **uploading an existing file** (a link near the top of that page)
   - Drag the entire contents of this project folder into the upload box (everything except the `node_modules` and `dist` folders, if present — they shouldn't be in what I gave you)
   - Scroll down, click **Commit changes**

---

## Step 3 — Deploy the website (Vercel)

1. Go to **https://vercel.com** and click **Sign Up**. Choose **Continue with GitHub** so the two are linked.
2. Click **Add New…** → **Project**.
3. Find your `duka-ledger` repository in the list and click **Import**.
4. Vercel will detect it's a Vite project automatically. Before clicking deploy, open **Environment Variables** and add these two (using the values you saved from Step 1):

   | Name | Value |
   |---|---|
   | `VITE_SUPABASE_URL` | your Project URL from Supabase |
   | `VITE_SUPABASE_PUBLISHABLE_KEY` | your publishable (or anon) key from Supabase |

5. Click **Deploy**. Wait about a minute.
6. When it finishes, Vercel gives you a live link like `https://duka-ledger-yourname.vercel.app` — **this is the link your employees will use.**

---

## Step 4 — Try it out

1. Open the Vercel link on your own phone.
2. Tap **Owner login** → since no PIN exists yet, you'll be asked to set one. Choose a 4-digit PIN only you know.
3. Open the same link on a different device (or just a new private/incognito browser tab) and tap **I work at a shop** → pick a shop → log a test sale.
4. Go back to your owner view and confirm the test sale shows up. If it does, everything is wired correctly — delete the test entry and you're ready to roll it out.

---

## Step 5 — Get employees using it

Share the Vercel link with each shop (WhatsApp is fine). On a phone:

- **iPhone (Safari):** open the link → tap the Share icon → **Add to Home Screen**. It now behaves like an installed app.
- **Android (Chrome):** open the link → tap the **⋮** menu → **Add to Home screen** / **Install app**.

Once installed, employees just tap the icon like any other app — no browser address bar, full screen.

---

## Notes on how it works

- **All data is shared and synced in real time.** When any shop or the warehouse logs something, it appears in your owner view automatically — no refresh needed, no manual collection.
- **It needs internet.** If a shop's connection drops, the app will show a clear "No internet" message and entries won't save until it reconnects — nothing gets silently lost or duplicated.
- **The free tiers are enough.** Supabase's free database (500 MB) and Vercel's free hosting comfortably handle 5 shops + a warehouse logging daily sales and transfers — you're nowhere near the limits for a business this size.
- **Updates:** if you ever want me to change something in the app, I'll give you an updated `App.jsx` (or other files) — you just re-upload the changed file(s) to your GitHub repository (Step 2's "uploading an existing file" trick works again) and Vercel automatically redeploys within a minute.

---

## If something goes wrong

- **Owner view says "No connection"**: double-check the two environment variables in Vercel (Project Settings → Environment Variables) exactly match your Supabase Project URL and key, with no extra spaces. After fixing, click **Deployments** → **⋯** on the latest one → **Redeploy**.
- **A shop can't reach the site**: check they have data/wifi — this version is online-only by design, as discussed.
- **Forgot the owner PIN**: in Supabase, go to **Table Editor** → `settings` table → delete the row where `key` is `owner-pin`. The app will then ask you to set a new PIN next time you tap Owner login.
