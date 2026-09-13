# Architecture

## Component diagram

```mermaid
flowchart TB
    subgraph Client["React SPA (Vercel)"]
        UI["Pages: Login / Register / Dashboard / Event / PublicGallery"]
        AuthCtx["AuthContext (JWT in localStorage)"]
        ApiLib["lib/api.js — fetch wrapper"]
        UI --> AuthCtx --> ApiLib
    end

    subgraph API["Express API (Render)"]
        direction TB
        Routes["routes/*"]
        MW["middleware:\nvalidate(zod) · requireAuth · requireRole ·\nrequireGalleryToken · errorHandler"]
        Ctrl["controllers/*"]
        Authz["utils/authz.js (pure functions)"]
        StoreIf["services/storage (save/getStream/delete)"]
        Routes --> MW --> Ctrl
        Ctrl --> Authz
        Ctrl --> StoreIf
    end

    subgraph Data["Managed data"]
        PG[("PostgreSQL\nusers · events · eventMembers\nphotos (metadata) · galleries · galleryPhotos")]
        OS[("Object storage\nSupabase bucket (private)\nraw image bytes")]
    end

    ApiLib -- "HTTPS + Bearer JWT" --> Routes
    Ctrl -- Prisma --> PG
    StoreIf --> OS
```

## Sequence: team member uploads, admin publishes, customer views

```mermaid
sequenceDiagram
    actor M as Team Member
    actor A as Admin/Lead
    actor C as Customer
    participant API
    participant DB as PostgreSQL
    participant S as Object storage

    A->>API: POST /events  (JWT: ADMIN)
    API->>DB: insert Event(owner=A)
    A->>API: POST /events/:id/members {name,email,password}
    API->>DB: insert User(MEMBER) + EventMember

    M->>API: POST /events/:id/photos  (multipart, JWT: MEMBER)
    API->>API: canUploadToEvent(M, event)?
    API->>S: save(key, bytes)
    API->>DB: insert Photo(metadata, uploadedBy=M)

    A->>API: GET /events/:id/photos  (JWT: ADMIN)
    API-->>A: ALL photos (scope=all)
    A->>API: PATCH /events/:id/photos/selection {photoIds, selected:true}
    A->>API: PUT /events/:id/gallery {title, pin}
    API->>DB: insert Gallery(slug, pinHash) + GalleryPhoto[]
    A->>API: POST /galleries/:id/publish
    API->>DB: Gallery.isPublished = true

    C->>API: GET /public/galleries/:slug
    API-->>C: {title, requiresPin:true}
    C->>API: POST /public/galleries/:slug/verify {pin}
    API->>API: bcrypt.compare(pin, pinHash)
    API-->>C: gallery JWT (2h)
    C->>API: GET /public/galleries/:slug/photos  (gallery JWT)
    API->>DB: GalleryPhoto join Photo
    API-->>C: [{id, url?token=…}]
    C->>API: GET …/photos/:pid/raw?token=…
    API->>S: getStream(key)
    API-->>C: image bytes
```

## Why these boundaries

- **Pure `authz.js`** — every "who can do what" rule is a small function with no
  Express or Prisma import, so the rules are unit-tested exhaustively and the
  controllers stay readable.
- **Storage interface** — controllers never import a cloud SDK. Swapping local
  disk for Supabase (or S3 later) is one new file + one env var.
- **Metadata in SQL, bytes in a bucket** — the DB stays small and queryable; the
  bucket is private and images are proxied through an access check so no
  public/guessable object URL exists.
- **Separate gallery token** — a customer never receives a user session; the
  gallery JWT is scoped to a single slug and expires quickly.
