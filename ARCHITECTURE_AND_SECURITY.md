# Architecture & Security

This document explains how PricePulse Myanmar is built, how it is secured, and
— importantly for a competition — **what is real today and what is a documented
next step**. We would rather be precise than impressive.

---

## 1. High-level architecture

```
Browser (React / Next.js client components)
    │  fetch('/api/...', credentials: same-origin cookie)
    ▼
Next.js App Router server (Node runtime)
    │  app/api/**/route.ts        ← the ONLY trust boundary
    │    guard(req, roles)        ← authenticate + authorise
    │    lib/services/*           ← business rules
    │    lib/db/store             ← exclusive() serialised read-modify-write
    ▼
Persistence
    default: server-side JSON document store (.pricepulse_data.json)  [single process]
    optional: Cloud Firestore (Admin SDK)  [multi-instance, enabled by env]

Object storage (optional)
    Firebase Storage for centralised reference thumbnails (server-side uploads;
    public download token URL stored). Users vote and may suggest replacements.

AI (optional)
    Google Gemini (selectable models) with a deterministic parser fallback
```

The client is **never** a source of truth for identity or authorization. The
cookie carries an opaque random token; the server maps it back to a user, a
business and a role on every request.

### Production topology

The frontend and backend deploy separately but stay same-origin from the
browser's point of view:

```
Browser ──▶ Firebase Hosting (static frontend, https://<project>.web.app)
                │  rewrite: /api/**  →  Cloud Run
                ▼
            Cloud Run (Next.js API backend, https://<service>.a.run.app)
```

Because Hosting proxies `/api/**` to Cloud Run, the browser only ever calls
`/api/...` on the Hosting origin. That keeps the `HttpOnly` session cookie
same-origin (no CORS, no `SameSite=None`). The frontend is a **static export**
(`npm run build:web`); the backend is the Next.js **standalone** server
(`npm run build`, deployed via the repo `Dockerfile`). See `DEPLOYMENT.md`.

### The one rule that shapes everything

There is **no** endpoint that returns the whole database. The single bulk read
is `GET /api/bootstrap`, which computes a **role-scoped** snapshot:

| Collection | Wholesaler | Retailer | Admin |
| --- | --- | --- | --- |
| products | own only | active-connection only | all |
| price history | own products | visible products | all |
| inventory | none | own | all |
| orders | own | own | all |
| notifications | own recipient | own recipient | — |
| audit logs | none | none | all |
| directory | wholesalers | wholesalers | wholesalers |

(Source of truth: `app/api/bootstrap/route.ts`, backed by `lib/auth/rbac.ts`.)

---

## 2. The price-update workflow (the core feature)

```
capture ──▶ extract ──▶ validate ──▶ human confirm ──▶ publish (1 product)
   │            │            │              │                 │
 paste/import  Gemini or    lib/ai/schema  explicit action   lib/services/pricing.ts
               deterministic                                 │
                                                             ├─ update product.currentPrice
                                                             ├─ append immutable priceHistory
                                                             └─ notify ONLY active retailers
```

Design guarantees:

- **No fabrication.** The deterministic parser (`lib/ai/extractor.ts`) reports
  missing values in `missingFields` instead of inventing dates, units or old
  prices. AI output is passed through `validateExtractedDraft` and treated as
  untrusted.
- **Human in the loop.** Extraction and import create **pending drafts**. Only a
  confirmed draft (or an explicit manual publish) changes a price.
- **One product per publish.** `publishPriceChange` touches exactly one
  `SupplierProduct`.
- **Immutable history.** Every publish appends a `PriceHistoryRecord`; records
  are never edited or deleted by the app.
- **Targeted, de-duplicated notifications.** Only retailers with an **active**
  connection at publish time are notified, and a `dedupeKey` prevents duplicates.

### Ordering / receiving

```
retailer places order ──▶ wholesaler accepts → preparing → ready → delivered
                                                          │
                                              retailer confirms receipt ──▶ stock += qty
```

Stock increases in **exactly one** place: `confirmReceipt`
(`lib/services/orders.ts`). It is **idempotent** — a second confirmation throws
`ALREADY_CONFIRMED` (HTTP 409) and adds no stock. A `PurchaseHistoryRecord` is
written per line, freezing the agreed unit price at that moment.

---

## 3. Authentication & authorization

| Concern | Implementation |
| --- | --- |
| Password storage | `scrypt` (64-byte key) with a random 16-byte per-user salt (`lib/auth/password.ts`). No plaintext, no reversible encoding. |
| Login comparison | `crypto.timingSafeEqual` |
| Session | Opaque 32-byte random token in an `HttpOnly`, `SameSite=Lax`, `Secure`-in-production cookie named `__session` (Firebase Hosting only forwards this name to Cloud Run). 7-day expiry. |
| Session lookup | Server-side map `token → { userId, expiresAt }`; expired tokens are deleted on access. |
| Role checks | `guard(req, ['wholesaler'])` on every mutating route + central predicates in `lib/auth/rbac.ts`. |
| Registration | Role is **forced** to `retailer` or `wholesaler`. Admin cannot self-register (`validateRegistration`). |
| Admin reset | Admin issues a **one-time token** (hashed, 30-minute expiry). The user redeems it themselves. The admin never sees or sets a password. |
| Demo login | Fixed persona keys map to **seeded demo users only**; it cannot target a real account. |
| Credential leakage | `toPublicUser` strips `passwordHash` / `passwordSalt` before anything crosses the wire. |

**No secret is ever sent to the browser.** There are no `NEXT_PUBLIC_` secrets;
`GEMINI_API_KEY`, `FIREBASE_PRIVATE_KEY` and friends are read only in server code.

---

## 4. Data integrity & concurrency

- All writes go through `dbStore.exclusive(fn)`, a serialised queue, so
  read-modify-write blocks cannot interleave **within the process**.
- Validation is centralised in `lib/validation.ts` (phone, username, password
  strength, calendar-valid ISO dates, price sanity ceiling).
- Uploaded CSV/Excel is validated by content signature, size-capped (2 MB) and
  row-capped (2,000). It is parsed to drafts, never written directly.

### Honest limitation

The default store is a **single-process** JSON document store. It is perfect for
a demo and a single-instance deployment, but it is **not** a distributed
database. Multi-instance concurrency safety requires Firestore (below).

---

## 5. Firebase / Firestore status

- **The Firestore adapter is implemented** (`lib/db/firestore.ts`). When the
  three Firebase admin env vars are present, `persistenceMode()` returns
  `'firestore'` and every write goes to Firestore (one document per record);
  otherwise the single-process JSON file store is used.
- `dbStore` keeps synchronous reads for existing routes, with `await
  dbStore.ready()` guaranteeing the cache is loaded per request and
  `dbStore.exclusive(fn)` reloading a fresh snapshot and flushing only the
  records that changed (diff-based).
- `firebase-admin` is imported **lazily** and marked as an external server
  package, so the file backend and tests never pay its startup cost.
- `firestore.rules` remains **deny-all for client access**: by design the browser
  never talks to Firestore; the server (Admin SDK, which bypasses rules) is the
  only writer. Deploy with `firebase deploy --only firestore:rules`.

### Reference thumbnails (Firebase Storage + Gemini)

- Thumbnails are **centralised** (not per business) and keyed by a normalised item
  name (`normalizeItemKey`), so identical goods share one picture system-wide.
- The browser downscales to 512px (WebP, JPEG fallback) and uploads **directly to
  Firebase Storage with the client SDK** (`components/firebaseClient.ts`), then
  posts the resulting URL to `POST /api/thumbnails/submit`. The server validates
  the URL belongs to our bucket, downloads the bytes, and runs **Gemini image
  moderation + tagging** (`lib/ai/vision.ts`) before storing the thumbnail.
- **Moderation policy** (`THUMBNAIL_MODERATION`): `lenient` (default) accepts the
  picture as `unchecked` when Gemini is unavailable (offline-friendly); `strict`
  rejects unmoderated pictures. Rejected uploads are deleted from Storage.
- The active picture's URL is **denormalised** onto matching inventory/product
  documents as `activeThumbnailUrl`, and the AI-suggested category is applied to
  new items. Objects are written with a public download token; `storage.rules`
  allows public reads and size/content-type-limited creates.
- **Voting** (`POST /api/thumbnails/vote`) is one vote per user per picture.
  Submissions are gated: they open only once the active picture reaches the
  downvote threshold, and are capped at **one per user** and **five per item**.
  A suggestion is promoted to active automatically once it leads with enough
  upvotes; the previous picture is archived. All rules live in
  `lib/services/thumbnails.ts` (unit-tested).

**Honest limitation:** with the file backend the cache is single-process. The
Firestore backend is multi-instance safe, but reads on a warm instance may be up
to a few seconds stale (short cache TTL), and concurrent writes to the same
record are last-write-wins (no cross-instance transaction).

---

## 6. AI: Gemini with an honest fallback

- When `GEMINI_API_KEY` is set, `lib/ai/extractor.ts` calls Gemini server-side
  with a strict JSON instruction, and the response is passed through
  `validateExtractedDraft` (untrusted input → coerced, range-checked, dates
  verified against the real calendar). The **model is user-selectable** from an
  allow-list in `lib/ai/models.ts` (the server never passes an arbitrary string
  to the SDK), with `GEMINI_MODEL` as the server default.
- When the key is absent (or the call fails), a **deterministic parser** handles
  English, Burmese and mixed messages, including Myanmar numerals. It never
  invents data and flags ambiguity for review.
- The UI reports which path was used, so a judge always knows whether the answer
  came from a live model or the local parser.

---

## 7. Demo-vs-real isolation

- Every seeded record carries `isDemo: true`.
- `dbStore.resetDemo()` restores demo records and **preserves** all real records
  **and all sessions** (so the admin performing a reset stays signed in). It is
  safe to retry.
- Demo login can only ever reach demo users.

---

## 8. Known limitations / next steps

1. **Firestore concurrency** — writes flush only changed records, but
   simultaneous writes to the *same* record are last-write-wins (no distributed
   transaction). Fine for the demo; add optimistic versioning for production.
2. **Rate limiting** on auth and extraction endpoints (not present yet).
3. **Thumbnail URLs** — stored objects carry a public download token, so anyone
   with the URL can view them (acceptable for product photos). Voting is
   one-per-user and moderation is vote-driven; there is no human moderator.
4. **Reset-token delivery** — the one-time token is shown to the admin to pass on
   out-of-band; no email/SMS delivery.
5. **`xlsx` dependency** carries known advisories; parse untrusted files in an
   isolated worker or replace with a maintained parser before production.
