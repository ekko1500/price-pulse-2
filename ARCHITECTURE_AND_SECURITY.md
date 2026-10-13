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
Persistence (interchangeable backends, same accessor surface)
    default: server-side JSON document store (.pricepulse_data.json)
    cloud:   Cloud Firestore (Admin SDK) — transactional, multi-instance safe
```

The client is **never** a source of truth for identity or authorization. The
cookie carries an opaque random token; the server maps it back to a user, a
business and a role on every request.

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
| Session | Opaque 32-byte random token in an `HttpOnly`, `SameSite=Lax`, `Secure`-in-production cookie (`pp_session`). 7-day expiry. |
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

### Backends

`lib/db/store.ts` selects a backend automatically via `persistenceMode()`:

- **`file`** (default) — a single-process JSON document store. Perfect for local
  development and a single-instance deployment.
- **`firestore`** — enabled when Firebase credentials are present (or on a managed
  runtime via Application Default Credentials). Mutations run inside Firestore
  **transactions** against the latest committed schema, so concurrent instances do
  not clobber each other. Override with `PRICEPULSE_BACKEND=file|firestore`.

In both modes the read surface stays synchronous (`getData()`), so route code is
unchanged. `lib/db/firestore.ts` mirrors the whole schema into one document and is
hydrated at startup by `instrumentation.ts`.

### Honest limitation

- Firestore stores the schema in a **single document**, which Firestore caps at
  **1 MiB**. That is ample for the demo dataset and early production; a
  high-volume deployment should shard the schema into collections (the DataStore
  surface does not change).
- Reads other than the transactional write path are served from an in-memory
  mirror. `apphosting.yaml` therefore pins **`maxInstances: 1`** for consistency.
  Scaling past one instance requires read-through accessors for auth/session reads.

---

## 5. Firebase / Firestore status

- `firebase.json` and `firestore.rules` are included. The rules are **deny-all
  for client access** because, by design, the browser never talks to Firestore;
  the server (Admin SDK, which bypasses rules) is the only writer.
- The Firestore adapter **is implemented** (`lib/db/firestore.ts`) and the store
  switches to it automatically when credentials are present. It has not been
  integration-tested against a live project from this environment (no Firestore
  database provisioned here), so validate it against the emulator or a staging
  project before relying on it in production.
- On Firebase App Hosting / Cloud Run, Application Default Credentials are used
  automatically; no service-account keys are needed in the environment.
- The local command `PRICEPULSE_BACKEND=file npm run dev` forces the file store
  even when credentials are present in `.env.local`.

---

## 6. AI: Gemini with an honest fallback

- When `GEMINI_API_KEY` is set, `lib/ai/extractor.ts` calls Gemini server-side
  with a strict JSON instruction, and the response is passed through
  `validateExtractedDraft` (untrusted input → coerced, range-checked, dates
  verified against the real calendar).
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

1. **Firestore integration test** — the adapter is implemented; validate it
   against the emulator / staging project and add it to CI.
2. **Rate limiting** on auth and extraction endpoints (not present yet).
3. **Read-through at scale** — needed to run more than one instance; today the
   store is pinned to a single instance for read consistency.
4. **Email/SMS delivery** of reset tokens — currently the one-time token is
   shown to the admin to pass on out-of-band.
5. **`xlsx` dependency** carries known advisories; parse untrusted files in an
   isolated worker or replace with a maintained parser before production.
