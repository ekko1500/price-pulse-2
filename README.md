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
| **Wholesaler** | Manage catalog, publish price updates (manual / AI / import), approve connections, process orders, view history |
| **Retailer** | Price alerts with margin intelligence, supplier comparison, inventory (manual + CSV), place orders, confirm receipt, connections |
| **Admin** | Accounts (activate/deactivate), issue one-time password-reset tokens, view audit log, reset the demo dataset |

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
npm run dev         # start the dev server
npm run build       # production build
npm start           # run the production build
npm test            # run the Vitest suite (60 tests)
npm run typecheck   # tsc --noEmit
npm run lint        # next lint
```

---

## Configuration

Copy `.env.example` to `.env.local`. Everything is optional for the demo:

```ini
GEMINI_API_KEY=            # enables live AI extraction; otherwise a strict parser runs
GEMINI_MODEL=gemini-1.5-flash

# Optional Firebase / Firestore backend (see ARCHITECTURE_AND_SECURITY.md)
# When these are set the store switches to Cloud Firestore automatically.
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=
# Force a backend for local runs (e.g. `PRICEPULSE_BACKEND=file`)
PRICEPULSE_BACKEND=
```

With **no** `GEMINI_API_KEY`, the app is fully functional using a deterministic
parser for English, Burmese and mixed messages (including Myanmar numerals).
The UI tells the user which path was used.

## Deploy to Firebase

This app uses API routes, server sessions and SSR, so it needs a **running Node
server** — a static Firebase Hosting site cannot serve it. Use **Firebase App
Hosting**:

1. Upgrade the project to the **Blaze** plan, then in the Firebase Console create
   the **Firestore database** and enable the Firestore API.
2. Console → **Build → App Hosting → Create backend** → connect the GitHub repo,
   branch **main**, root `/`. App Hosting auto-detects Next.js.
3. It uses Application Default Credentials, so only add secrets you need
   (e.g. `GEMINI_API_KEY` via Secret Manager). Do **not** add the service-account
   key on App Hosting.
4. Deploy; pushes to `main` redeploy automatically.

Notes: `apphosting.yaml` pins `maxInstances: 1` because reads are served from an
in-memory mirror (IDs stay consistent across requests). See
`ARCHITECTURE_AND_SECURITY.md` for the Firestore scaling limits.

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
components/         React UI (landing, dashboards, panels, i18n)
lib/
  ai/               Extraction: Gemini path + deterministic parser + validation
  auth/             scrypt passwords, sessions, RBAC predicates
  calc/             Deterministic pricing + unit-comparison math (unit-tested)
  db/               Persistence: file store + Cloud Firestore adapter
  seed/             Isolated demo dataset
  services/         Pricing publish + order/receipt business logic
  types/            Domain types
tests/              Vitest suite (pricing, units, extraction, RBAC, services)
```

## Documentation

- [`ARCHITECTURE_AND_SECURITY.md`](ARCHITECTURE_AND_SECURITY.md) — how it works and how it's secured (and what is *not* yet production-grade)
- [`TEST_EVIDENCE.md`](TEST_EVIDENCE.md) — the test suite and what each test proves
- [`JUDGE_DEMO_SCRIPT.md`](JUDGE_DEMO_SCRIPT.md) — a 4-minute guided walkthrough
- [`COMPETITION_PITCH.md`](COMPETITION_PITCH.md) — problem, solution, impact, honesty

## Licence

Built for the Google AI Builder Cup 2026. Sample data is fictional.
