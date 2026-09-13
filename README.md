# PhotoShare — Collaborative Event Photo Platform

A full-stack photo-sharing application for photography / event teams.

- **Team members** upload photos to an event.
- An **Admin / Lead** reviews every upload, selects the keepers, and publishes a
  customer-facing gallery protected by a PIN.
- The **customer** opens a shareable link, enters the PIN, and browses the
  published photos — no account required.

Built for the TrizenAI Full-Stack Internship Challenge.

**Live app:** https://photo-platform-client.vercel.app
**Live API:** https://photo-platform-api-034m.onrender.com
**Demo gallery:** https://photo-platform-client.vercel.app/gallery/demo-gallery — PIN `482917`

> The API is on Render's free tier and sleeps after ~15 min idle — the first
> request can take 30–60s to wake it up.

---

## Table of contents

1. [Technology stack](#technology-stack)
2. [System architecture](#system-architecture)
3. [Database design](#database-design)
4. [API overview](#api-overview)
5. [Local setup](#local-setup)
6. [Environment variables](#environment-variables)
7. [Running the tests](#running-the-tests)
8. [Deployment](#deployment)
9. [Demo credentials](#demo-credentials)
10. [Security notes](#security-notes)
11. [Known limitations](#known-limitations)

---

## Technology stack

| Layer        | Choice                              | Why                                                             |
| ------------ | ----------------------------------- | -------------------------------------------------------------- |
| Frontend     | React 18 + Vite + React Router      | Fast dev server, simple SPA routing                            |
| Styling      | Tailwind CSS                        | Consistent, responsive UI without hand-written CSS             |
| Backend      | Node.js + Express                   | Small, explicit REST API                                       |
| ORM          | Prisma                              | Typed schema, migrations, readable queries                    |
| Database     | PostgreSQL                          | Relational data (users ↔ events ↔ photos ↔ gallery)           |
| File storage | Pluggable: local disk **or** Supabase Storage | Image bytes never touch the database                 |
| Auth         | JWT (stateless) + bcrypt password hashing | Standard, no session store needed                       |
| Validation   | Zod                                | One schema per request, coerces + rejects bad input           |
| Tests        | Vitest + Supertest                 | Unit tests for auth logic + end-to-end API tests              |

There is **no ORM lock-in on storage**: `server/src/services/storage/` exposes a
3-method interface (`save` / `getStream` / `delete`). `STORAGE_DRIVER=local` is
used in development; `STORAGE_DRIVER=supabase` in production. Adding S3/GCS is a
new file implementing the same interface.

---

## System architecture

```
                         ┌──────────────────────────────┐
                         │           Browser            │
                         │  React SPA (Vite build)      │
                         └──────────────┬───────────────┘
                                        │  HTTPS / JSON  (Bearer JWT)
                                        ▼
                         ┌──────────────────────────────┐
                         │        Express API           │
                         │  ── routes ─ controllers ──  │
                         │  auth │ events │ photos │    │
                         │  galleries │ public          │
                         │                              │
                         │  middleware:                 │
                         │   requireAuth / requireRole  │
                         │   requireGalleryToken        │
                         │   validate(zod) / errors     │
                         └───────┬───────────────┬──────┘
                                 │               │
              Prisma (SQL)       │               │  storage interface
                                 ▼               ▼
                   ┌───────────────────┐   ┌───────────────────────────┐
                   │   PostgreSQL      │   │  Object storage           │
                   │  users, events,   │   │  local disk (dev)         │
                   │  photos(metadata),│   │  Supabase Storage (prod)  │
                   │  galleries        │   │  — raw image bytes only   │
                   └───────────────────┘   └───────────────────────────┘
```

### Request lifecycle

1. **Route** matches the URL and attaches per-route middleware.
2. **`validate({ body, params, query })`** parses input with a Zod schema; a
   failure short-circuits with `400` and a list of field errors.
3. **Auth middleware**:
   - `requireAuth` → verifies a *user* JWT, loads `req.user`.
   - `requireRole('ADMIN')` → 403 unless the user has the role.
   - `requireGalleryToken` → verifies a short-lived *gallery* JWT issued after a
     correct PIN (used only on `/api/public/*`).
4. **Controller** runs the business logic. Cross-cutting authorization
   (owner vs. assigned member vs. stranger) lives in pure functions in
   `server/src/utils/authz.js` so it is unit-tested in isolation.
5. **Error handler** converts `ApiError`, Zod, Multer and Prisma errors into a
   consistent `{ error: { message, details? } }` JSON shape. 5xx errors are
   logged server-side and never leak internals.

### Two kinds of token

| Token        | Issued by                          | Lifetime | Grants                                  |
| ------------ | ---------------------------------- | -------- | --------------------------------------- |
| User JWT     | `/api/auth/login` `/register`      | 7 days   | Acting as that Admin or Team Member     |
| Gallery JWT  | `/api/public/galleries/:slug/verify` after correct PIN | 2 hours | Read-only access to **one** published gallery |

Photos are always streamed **through the API** after an access check — the
storage bucket stays private and no direct/public object URL is ever exposed.

---

## Database design

Prisma schema: [`server/prisma/schema.prisma`](server/prisma/schema.prisma).

```
User ──1:N──> Event            (owner; role = ADMIN)
User ──1:N──> Photo            (uploadedBy)
User <──M:N──> Event           via EventMember   (assigned team members)
Event ──1:N──> Photo
Event ──1:1──> Gallery
Gallery ──1:N──> GalleryPhoto ──N:1──> Photo     (ordered snapshot of the published selection)
```

| Model          | Key fields                                                                                  | Notes |
| -------------- | ------------------------------------------------------------------------------------------- | ----- |
| `User`         | `email` (unique), `passwordHash`, `role` (`ADMIN` \| `MEMBER`)                              | Admins self-register; members are created by an Admin |
| `Event`        | `name`, `ownerId`                                                                          | Owner is the Admin/Lead |
| `EventMember`  | `(eventId, userId)` unique                                                                  | Join table — who may upload to the event |
| `Photo`        | `eventId`, `uploadedById`, `filename`, `storageKey`, `mimeType`, `fileSize`, `isSelected`  | **Metadata only** — bytes live in object storage |
| `Gallery`      | `eventId` (unique), `slug` (unique), `pinHash`, `isPublished`, `publishedAt`, `expiresAt`  | One draft/published gallery per event; PIN stored as a bcrypt hash |
| `GalleryPhoto` | `(galleryId, photoId)` unique, `position`                                                   | The exact set + order a customer sees |

`isSelected` on `Photo` is the Admin's working selection. Publishing (or saving)
the gallery snapshots the currently-selected photos into `GalleryPhoto` rows, so
later selection changes don't silently alter a published gallery until the Admin
re-syncs.

---

## API overview

Base path: `/api`. All bodies are JSON unless noted.

### Auth
| Method | Path             | Auth | Purpose |
| ------ | ---------------- | ---- | ------- |
| POST   | `/auth/register` | –    | Create an **Admin** account, returns JWT |
| POST   | `/auth/login`    | –    | Log in (Admin or Member), returns JWT |
| GET    | `/auth/me`       | user | Current user |

### Events & team
| Method | Path                                   | Auth  | Purpose |
| ------ | -------------------------------------- | ----- | ------- |
| POST   | `/events`                              | admin | Create event |
| GET    | `/events`                              | user  | Admin → owned events; Member → assigned events |
| GET    | `/events/:eventId`                     | owner/member | Event detail |
| PATCH  | `/events/:eventId`                     | owner | Rename / edit |
| DELETE | `/events/:eventId`                     | owner | Delete event (cascades) |
| GET    | `/events/:eventId/members`             | owner/member | List members |
| POST   | `/events/:eventId/members`             | owner | Create a Member user + assign |
| DELETE | `/events/:eventId/members/:userId`     | owner | Unassign a member |

### Photos
| Method | Path                                        | Auth | Purpose |
| ------ | ------------------------------------------- | ---- | ------- |
| POST   | `/events/:eventId/photos`                   | owner/member | Multipart upload, field `photos`, multiple files, partial-failure aware |
| GET    | `/events/:eventId/photos`                   | owner/member | Owner → all; Member → **only their own** |
| PATCH  | `/events/:eventId/photos/selection`         | owner | `{ photoIds, selected }` toggle gallery selection |
| GET    | `/photos/:id/raw`                           | owner/member (own) | Stream the image bytes (access-checked) |
| DELETE | `/photos/:id`                               | owner or uploader | Delete photo + object |

### Gallery (Admin)
| Method | Path                                | Auth  | Purpose |
| ------ | ---------------------------------- | ----- | ------- |
| GET    | `/events/:eventId/gallery`          | owner/member | Current gallery (or `null`) |
| PUT    | `/events/:eventId/gallery`          | owner | Create/replace draft from the current selection (`{ title, pin }`) |
| PATCH  | `/galleries/:id`                    | owner | Update title / PIN / photo set |
| POST   | `/galleries/:id/publish`            | owner | Publish |
| POST   | `/galleries/:id/unpublish`          | owner | Unpublish (link stops working) |

### Public (customer, no account)
| Method | Path                                                  | Auth | Purpose |
| ------ | ---------------------------------------------------- | ---- | ------- |
| GET    | `/public/galleries/:slug`                            | –    | Title + "PIN required" (404 if not published) |
| POST   | `/public/galleries/:slug/verify`                     | –    | `{ pin }` → gallery JWT (401 on wrong PIN) |
| GET    | `/public/galleries/:slug/photos`                     | gallery token | Ordered photo list with tokenised URLs |
| GET    | `/public/galleries/:slug/photos/:photoId/raw`        | gallery token | Stream a published photo |

---

## Local setup

### Prerequisites
- Node.js 20+
- A PostgreSQL database (local install, Docker, or a free Supabase project)

### Steps

```bash
# 1. install (root + both workspaces)
npm install

# 2. configure the server
cp server/.env.example server/.env
#    then edit server/.env and set DATABASE_URL + JWT_SECRET
#    generate a secret:  node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"

# 3. configure the client (optional for local dev — the Vite proxy handles /api)
cp client/.env.example client/.env

# 4. create the database schema
npm run prisma:migrate         # runs `prisma migrate dev` in server/

# 5. (optional) load demo data — Admin, members, an event, photos, a published gallery
npm run seed

# 6. run both dev servers (API on :4000, web on :5173)
npm run dev
```

Open <http://localhost:5173>.

- Dev uses `STORAGE_DRIVER=local`; uploaded files go to `server/uploads/`
  (git-ignored).
- The Vite dev server proxies `/api` → `http://localhost:4000`, so there are no
  CORS issues locally.

---

## Environment variables

### `server/.env`
| Variable | Required | Description |
| -------- | -------- | ----------- |
| `PORT` | no (4000) | API port |
| `NODE_ENV` | no | `development` \| `production` \| `test` |
| `CORS_ORIGIN` | prod | Comma-separated allowed frontend origins |
| `DATABASE_URL` | **yes** | PostgreSQL connection string |
| `JWT_SECRET` | **yes** | Long random string for signing tokens |
| `JWT_EXPIRES_IN` | no (7d) | User token lifetime |
| `GALLERY_TOKEN_EXPIRES_IN` | no (2h) | Customer gallery token lifetime |
| `STORAGE_DRIVER` | no (`local`) | `local` \| `supabase` |
| `LOCAL_STORAGE_DIR` | local only | Folder for uploaded files |
| `PUBLIC_API_URL` | no | API's public base URL |
| `SUPABASE_URL` | supabase only | Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | supabase only | **Service role** key (server-side, secret) |
| `SUPABASE_STORAGE_BUCKET` | no (`photos`) | Private bucket name |
| `MAX_UPLOAD_MB` | no (15) | Per-file size limit |
| `MAX_FILES_PER_UPLOAD` | no (20) | Batch size limit |
| `TEST_DATABASE_URL` | test only | DB for the integration test suite |

### `client/.env`
| Variable | Description |
| -------- | ----------- |
| `VITE_API_URL` | Empty for local dev (uses the proxy). In production, the API origin, e.g. `https://photo-platform-api.onrender.com` |

---

## Running the tests

```bash
# from server/
npm test
```

- **`tests/authz.test.js`** — pure role/ownership rules (owner vs. member vs.
  stranger, photo visibility scope, who can publish). No DB.
- **`tests/pin.test.js`** — PIN format validation + bcrypt hash/verify.
- **`tests/api.test.js`** — full end-to-end HTTP tests via Supertest, covering the
  scenarios the challenge calls out:
  - registration / duplicate / wrong-password login
  - Admin-only event creation
  - a Team Member seeing **only their own** photos
  - a Member **blocked** from another member's photo bytes (403)
  - a Member **blocked** from selecting photos / publishing a gallery (403)
  - Admin select → create gallery → publish
  - customer: wrong PIN → 401, correct PIN → token → photos
  - unpublished / unpublished-again gallery → 404

  This suite needs a throwaway Postgres. Set `TEST_DATABASE_URL` and push the
  schema once:

  ```bash
  DATABASE_URL="$TEST_DATABASE_URL" npx prisma db push
  npm test
  ```

  Without `TEST_DATABASE_URL` the API suite is skipped and the two pure suites
  still run.

---

## Deployment

Target: **Vercel** (frontend) + **Render** (API) + **Supabase** (PostgreSQL +
private Storage bucket). All have free tiers that need no credit card.

Full step-by-step: [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

Summary:

1. **Supabase** — create a project. Copy the DB connection string. Create a
   **private** Storage bucket named `photos`. Copy the project URL + service role
   key.
2. **Render** — new Web Service from the repo, root `server/`,
   build `npm install && npx prisma migrate deploy`,
   start `npm start`. Set env vars (`DATABASE_URL`, `JWT_SECRET`,
   `STORAGE_DRIVER=supabase`, `SUPABASE_*`, `CORS_ORIGIN` = your Vercel URL).
   [`render.yaml`](render.yaml) captures this.
3. **Vercel** — import the repo, root `client/`, framework **Vite**. Set
   `VITE_API_URL` to the Render URL. SPA routing handled by
   [`client/vercel.json`](client/vercel.json).
4. Run the seed once against the production DB (locally, with `DATABASE_URL`
   pointed at Supabase and `STORAGE_DRIVER=supabase`) to create demo data.

---

## Demo credentials

Live on https://photo-platform-client.vercel.app (created by `npm run seed`):

| Role          | Email              | Password        |
| ------------- | ------------------ | --------------- |
| Admin / Lead  | `admin@demo.com`   | `Admin@12345`   |
| Team Member 1 | `member1@demo.com` | `Member@12345`  |
| Team Member 2 | `member2@demo.com` | `Member@12345`  |

- **Event:** "Arjun & Priya Wedding" — 12 uploaded photos, 8 selected.
- **Published gallery:** https://photo-platform-client.vercel.app/gallery/demo-gallery
- **Gallery PIN:** `482917`

---

## Security notes

- Passwords: bcrypt (cost 10). PINs: bcrypt too — never stored or logged in
  plain text.
- Same error for "unknown email" and "wrong password" (no account enumeration).
- Unpublished / unknown galleries return **404, not 403**, so the public surface
  never confirms a gallery exists before the PIN is presented.
- Events a user is unrelated to also return **404**, not 403 — no leaking of
  other teams' event IDs.
- Photo bytes are only ever served after an ownership/role/gallery-membership
  check; the storage bucket is private.
- `helmet` for security headers; CORS restricted to configured origins.
- Uploads: MIME allow-list (jpeg/png/webp/gif/avif), per-file size cap, per-batch
  count cap; a failed file is cleaned up from storage and reported without
  failing the whole batch.
- No secrets in the repo — `.env` is git-ignored, `.env.example` documents keys.

---

## Known limitations

- **Render free tier** sleeps the API after ~15 min idle; the first request then
  takes ~30–60 s to wake. Not an issue once warm.
- **Supabase free tier** pauses a project after ~7 days of inactivity; restore it
  from the dashboard before a review.
- No image thumbnailing yet — the grid loads full-size images. `Photo.width` /
  `height` columns exist for when resizing is added.
- No pagination on photo lists (fine for demo-scale events).
- Local storage driver is single-node only; production uses Supabase Storage.
- `qs`/`body-parser` transitive advisories from Express 4 remain; upgrading to
  Express 5 is the fix and is left as a follow-up to avoid churn during the
  challenge.
- Gallery PIN has no rate-limiting on attempts — a per-IP limiter is the natural
  next step.
