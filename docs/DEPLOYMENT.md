# Deployment guide

Stack: **Supabase** (PostgreSQL + private file storage) · **Render** (Express API)
· **Vercel** (React frontend). All free tier, no credit card.

Do these in order. Steps marked 🧑 must be done by you in a browser (creating
accounts / entering keys); everything else is config already in the repo.

---

## 1. Supabase — database + storage 🧑

1. Sign up at <https://supabase.com> and create a new project. Pick a region
   near you. Save the **database password** you set.
2. **Connection string:** Project Settings → **Database** → *Connection string* →
   **URI**. It looks like
   `postgresql://postgres:<password>@db.<ref>.supabase.co:5432/postgres`.
   Keep it — this is `DATABASE_URL`.
3. **Storage bucket:** left sidebar → **Storage** → *New bucket* → name it
   `photos` → **uncheck "Public bucket"** (must stay private) → create.
4. **API keys:** Project Settings → **API**. Copy:
   - **Project URL** → `SUPABASE_URL`
   - **service_role** secret key → `SUPABASE_SERVICE_ROLE_KEY`
     (server-only; never goes in the frontend)

---

## 2. Push the schema + seed demo data (from your machine) 🧑

With Node installed locally and the repo cloned:

```bash
cd server
# point at the Supabase DB just for these commands
export DATABASE_URL="postgresql://postgres:<password>@db.<ref>.supabase.co:5432/postgres"

npx prisma migrate deploy      # creates all tables

# seed demo data INTO Supabase, storing images in the Supabase bucket
export STORAGE_DRIVER=supabase
export SUPABASE_URL="https://<ref>.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="<service_role key>"
export SUPABASE_STORAGE_BUCKET=photos
npm run seed
```

The seed prints the demo credentials, gallery slug and PIN — copy them into your
submission.

---

## 3. Render — the API 🧑

1. Sign up at <https://render.com> (log in with GitHub).
2. **New → Web Service** → connect this repository.
3. Settings:
   - **Root Directory:** `server`
   - **Runtime:** Node
   - **Build Command:** `npm install && npx prisma generate && npx prisma migrate deploy`
   - **Start Command:** `npm start`
   - **Health Check Path:** `/api/health`
   - **Instance Type:** Free
4. **Environment variables** (Advanced → Add):

   | Key | Value |
   | --- | ----- |
   | `NODE_ENV` | `production` |
   | `DATABASE_URL` | the Supabase URI from step 1 |
   | `JWT_SECRET` | run `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
   | `STORAGE_DRIVER` | `supabase` |
   | `SUPABASE_URL` | from step 1 |
   | `SUPABASE_SERVICE_ROLE_KEY` | from step 1 |
   | `SUPABASE_STORAGE_BUCKET` | `photos` |
   | `CORS_ORIGIN` | *(fill in after step 4)* your Vercel URL |
   | `PUBLIC_API_URL` | the Render URL of this service (e.g. `https://photo-platform-api.onrender.com`) |

5. Create the service. Wait for the first deploy → open
   `https://<your-service>.onrender.com/api/health` → should return
   `{"status":"ok"}`.

> The repo also has [`render.yaml`](../render.yaml) if you prefer Render
> Blueprints — you still fill the `sync: false` vars in the dashboard.

---

## 4. Vercel — the frontend 🧑

1. Sign up at <https://vercel.com> (log in with GitHub).
2. **Add New → Project** → import this repository.
3. Settings:
   - **Root Directory:** `client`
   - **Framework Preset:** Vite (auto-detected)
   - **Environment Variable:** `VITE_API_URL` = your Render URL from step 3
     (no trailing slash)
4. Deploy. You get a URL like `https://photo-platform.vercel.app`.
5. Go back to **Render → Environment** and set `CORS_ORIGIN` to that Vercel URL,
   then **Manual Deploy → Deploy latest commit** (or just save — Render
   restarts).

SPA routing (`/gallery/:slug`, `/events/:id`) is handled by
[`client/vercel.json`](../client/vercel.json).

---

## 5. Verify the live app

1. Open the Vercel URL → **Register as a Lead** (or log in with `admin@demo.com`
   / `Admin@12345` if you seeded).
2. Create an event, add a team member, sign in as them in a private window,
   upload a photo.
3. Back as admin: select photos → Gallery tab → create → **Publish** → copy the
   share link.
4. Open the share link in a fresh browser, enter the PIN → photos load.

---

## Submission checklist

- [ ] Live frontend URL (Vercel)
- [ ] Live API URL (Render) — `/api/health` responds
- [ ] Source repository link
- [ ] Demo Admin credentials
- [ ] Demo Team Member credentials
- [ ] Demo gallery URL + PIN
- [ ] README present with architecture + DB design
- [ ] `npm test` passes
- [ ] No secrets committed (`git grep -i secret`, check `.env` is ignored)
