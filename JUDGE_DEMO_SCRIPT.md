# Judge Demo Script (≈4 minutes)

A guided, click-by-click path that shows the whole loop: a wholesaler publishes
a price change, and the right retailer sees the exact margin impact.

> Open two browser windows side by side (or use one and switch accounts) so you
> can show the wholesaler action and the retailer reaction.

---

## 0. Setup (20s)

1. `npm install && npm run dev`
2. Open **http://localhost:3000** → **One-click demo access**.
3. Point out the banner: **Demo mode** — all businesses and prices are fictional.

**Say:** "Everything you'll see is isolated sample data. No real accounts, no
real prices."

---

## 1. Wholesaler publishes a price (90s)

1. Click **Wholesaler — Aung Wholesale**.
2. Open the **Price update** tab.
3. In the supplier message box, paste:

   ```
   Cooking Oil 1 Liter now 5800 MMK, was 5000, effective tomorrow
   ```

4. Click **Analyse message**.
   - A **pending draft** appears with a confidence score.
   - Point out: it did **not** publish anything. Nothing is live yet.
5. (Optional) Show the Burmese path:

   ```
   ဆီ ၁ လီတာ ၅၈၀၀ ကျပ်
   ```

6. Confirm the product is **Cooking Oil (1 Liter)**, keep the price **5,800**,
   then click **Publish price**.
7. Open the **Price history** tab — a new immutable row: **5,000 → 5,800 (+800, +16%)**.

**Say:** "One product changed. One history record written. Only actively
connected retailers were notified — and notice we never published straight from
the extracted text; a human confirmed it."

---

## 2. Retailer feels the impact (90s)

1. Switch to the **Retailer — Shwe Family Grocery** account
   (or the second window).
2. A notification badge is waiting. Open **Price alerts**.
3. Read the card:
   - Wholesale cost **5,000 → 5,800**
   - Their selling price is still **5,600**
   - Before: **+600 MMK, 10.7%** gross margin
   - After: **−200 MMK, −3.6%** — they would now sell at a loss
   - **Recommended price @15%: 6,900 MMK**
4. Point out the line: **"PricePulse never changes your selling price
   automatically."** Optionally click **Use this selling price**.
5. Open **Suppliers** — the same oil from two wholesalers, with a clear note when
   two products are **not directly comparable** because their package sizes
   can't be matched.

**Say:** "This is the heart of it. The retailer doesn't just get a number — they
get the consequence, and a decision they can act on."

---

## 3. Proof it's real, not a mockup (60s)

1. Open **Orders** for the retailer, and show **Confirm receipt** on the delivered
   order. Confirm the stock rises once. Click again (or refresh) — it is rejected,
   because receipt is **idempotent**.
2. Mention the test suite: `npm test` → **60 tests**, including the exact section-9
   benchmark and the idempotency guarantee. `TEST_EVIDENCE.md` lists them.
3. (Optional) Show an admin action: **Admin** → **Accounts** → **reset token**
   produces a one-time token, never a password.

---

## 4. Close (30s)

**Say:** "PricePulse is honest about its edges. With no Gemini key it runs a
strict local parser that never invents a price or a date. The Firestore adapter
is scaffolded and documented as the next step — the file store is what's tested
today. The judgment we want is for the *workflow and the trust model*: extract →
review → confirm → publish one product → immutable history → targeted alert."

---

## If something goes wrong

- **Demo account unavailable:** sign in as **Administrator** → **Demo data** →
  **Reset demo dataset** (real accounts and sessions are preserved).
- **No Gemini key:** expected — the app says a local parser was used, and the
  flow is identical.
- **Port in use:** `npm run dev -- -p 3001`.
