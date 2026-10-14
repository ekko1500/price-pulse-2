# PricePulse Myanmar

**AI-assisted wholesale → retail pricing intelligence for Myanmar small businesses.**
Entry for the **Google AI Builder Cup 2026**.

PricePulse turns the messy reality of Myanmar's wholesale supply chain — price
changes announced over the phone, in chat, or on paper — into a **structured,
reviewable, auditable** price update that flows to the right retailers and helps
them protect their margin.

> Currency is **MMK** everywhere. All sample businesses and prices are
> **fictional** and clearly labelled as demo data.

---

## The problem

A wholesaler changes a price. That news travels by word of mouth. Retailers find
out late, or not at all, and keep selling at an old price that is now below cost.
Nobody can answer "what did this cost last month, and who changed it?"

## What PricePulse does

1. **Capture** a supplier price message (paste it, or import a CSV/Excel sheet).
2. **Extract** price facts with AI (Gemini) *or* a strict deterministic parser
   when no key is configured. **Nothing is ever invented.**
3. **Review** the parsed draft — the human confirms the product, price and
   effective date. Missing fields are surfaced, not guessed.
4. **Publish** — exactly one supplier product is updated, an immutable
   price-history record is written, and only **actively connected** retailers
   get a de-duplicated notification.
5. **Act** — the retailer sees the margin impact, the recommended selling price
   for a target margin, and supplier comparisons. Stock only increases when the
   retailer **confirms receipt** of a delivery (idempotent).

## Roles

| Role | Can do |
| --- | --- |
| **Wholesaler** | Manage catalog, publish price updates (manual / AI / import), approve connections, process orders, run a point-of-sale terminal, view history |
| **Retailer** | Price alerts with margin intelligence, supplier comparison, inventory (manual + CSV), place orders, confirm receipt, run a point-of-sale terminal, connections |
| **Admin** | Accounts (activate/deactivate), issue one-time password-reset tokens, view audit log, reset the demo dataset |

### Point of sale (POS)

Both retailers and wholesalers get a **Sell (POS)** terminal:

- Retailers sell their own inventory at the selling price; stock is decremented
  and cost is captured for margin reporting.
- Wholesalers sell their catalog at wholesale prices; stock is decremented for
  products that carry a stock quantity (otherwise the sale is recorded only).
- Carts support quantities, a flat discount, customer details, payment methods
  (cash, KBZ Pay, Wave Pay, bank transfer, credit) and cash change calculation.
- Completing a sale writes an immutable `Sale` record, decrements stock atomically
  and offers an **Export receipt (PDF)** action. The **Sales** tab lists past
  receipts, re-exports any of them, and lets the seller void a sale (which
  restores stock, idempotently).

Receipts are exported as a real `.pdf` file generated in the browser with no
external dependency; Myanmar text is rendered through the canvas so it is
preserved in the PDF.

### Reference thumbnails (centralised)

Items do not carry their own picture. The system keeps a **centralised library of
reference thumbnails** on **Firebase Storage**, keyed by the item name, so the
same goods show the same picture everywhere (inventory, POS). Pictures are
downscaled in the browser (512px, WebP with a JPEG fallback) before upload.

- **Vote** any picture up or down (one vote per user per picture).
- When the active picture reaches **5 downvotes**, users may **suggest a better
  picture** — limited to **one per user** and **5 suggestions per item**; further
  submissions are blocked.
- A suggestion is **promoted to active automatically** once it has at least 3
  upvotes and leads the current active picture; the previous picture is archived
  (kept for history). That is how pictures get replaced over time.

Inventory **export is plain CSV** and **import accepts CSV/Excel**; thumbnails are
drawn from the central library and are not part of the file.

Admins **cannot** self-register and can **never** see a user's password.

---

## Quick start

```bash
npm install
npm run dev        # http://localhost:3000
```

Then click **One-click demo access** and pick a persona. No password required.

### Demo personas

| Persona | Business | Notes |
| --- | --- | --- |
| Wholesaler | Aung Wholesale Distribution (Yangon) | Publishes prices, has a cooking-oil catalog |
| Wholesaler 2 | Mandalay Commodity Depot | A second supplier to compare against |
| Retailer | Shwe Family Grocery Store | Sees alerts, margins, inventory |
| Retailer 2 | Kyaw Modern Mini Mart | Has a *pending* connection request |
| Administrator | PricePulse Oversight | Accounts, audit, demo reset |

### Commands

```bash
npm run dev         # start the dev server (frontend + API on one origin)
npm run build       # build the API server (standalone, for Cloud Run)
npm run build:web   # build the static frontend to ./out (for Firebase Hosting)
npm start           # run the production API build
npm test            # run the Vitest suite (85 tests)
npm run typecheck   # tsc --noEmit
npm run lint        # next lint
```

---

## Configuration

Copy `.env.example` to `.env.local`. Everything is optional for a local demo:

```ini
GEMINI_API_KEY=            # enables live AI extraction; otherwise a strict parser runs
GEMINI_MODEL=gemini-2.5-flash-lite   # users can also pick a model in the UI

# Cloud Firestore (multi-instance persistence). Blank = local JSON file store.
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=

# Firebase Storage for centralised reference thumbnails.
FIREBASE_STORAGE_BUCKET=
```

With **no** `GEMINI_API_KEY`, the app is fully functional using a deterministic
parser for English, Burmese and mixed messages (including Myanmar numerals).
The UI tells the user which path was used. With no Firebase vars it uses a
single-process JSON store and stores thumbnails inline (fine locally; use
Firestore + Storage when deploying). See
[`DEPLOYMENT.md`](DEPLOYMENT.md) for Firebase Hosting + Cloud Run + Firestore.

## Try the AI workflow

On the wholesaler **Price update** tab, paste something like:

```
Cooking Oil 1 Liter now 5800 MMK, was 5000, effective tomorrow
```

or in Burmese:

```
ဆီ ၁ လီတာ ၅၈၀၀ ကျပ်
```

The draft shows confidence, warnings and missing fields. Confirm a product and
publish — then sign in as the retailer to see the alert and margin impact.

---

## Project layout

```
app/                Next.js App Router pages + API routes
  api/              Role-scoped, server-only endpoints (the security boundary)
components/         React UI (landing, dashboards, panels, POS terminal, i18n)
  pos/              Point-of-sale terminal, sales history, PDF receipt export
lib/
  ai/               Extraction: Gemini (selectable models) + deterministic parser + validation
  auth/             scrypt passwords, sessions, RBAC predicates
  calc/             Deterministic pricing + unit-comparison math (unit-tested)
  db/               Persistence: file store + Firestore adapter (server-only)
  firebase/         Shared Firebase Admin bootstrap
  storage/          Firebase Storage uploader for reference thumbnails
  thumbnails/       Item-key normalisation + voting/suggestion thresholds
  seed/             Isolated demo dataset
  services/         Pricing publish + order/receipt + POS sale + thumbnail business logic
  types/            Domain types
tests/              Vitest suite (pricing, units, extraction, RBAC, services, sales, thumbnails, models)
```

## Documentation

- [`ARCHITECTURE_AND_SECURITY.md`](ARCHITECTURE_AND_SECURITY.md) — how it works and how it's secured (and what is *not* yet production-grade)
- [`DEPLOYMENT.md`](DEPLOYMENT.md) — deploy the static frontend to Firebase Hosting and the API to Cloud Run (with Firestore, Storage and Gemini)
- [`TEST_EVIDENCE.md`](TEST_EVIDENCE.md) — the test suite and what each test proves
- [`JUDGE_DEMO_SCRIPT.md`](JUDGE_DEMO_SCRIPT.md) — a 4-minute guided walkthrough
- [`COMPETITION_PITCH.md`](COMPETITION_PITCH.md) — problem, solution, impact, honesty

## Licence

Built for the Google AI Builder Cup 2026. Sample data is fictional.
