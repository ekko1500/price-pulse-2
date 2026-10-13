# Competition Pitch — PricePulse Myanmar

**Google AI Builder Cup 2026**

---

## One line

PricePulse turns a wholesaler's messy price announcement into a **reviewed,
auditable price change** — and shows every affected retailer exactly what it does
to their margin.

## The problem (why it matters here)

Myanmar's small shops run on thin margins and informal channels. A wholesaler
changes a price; the news travels by phone calls and word of mouth. Retailers
learn late — or never — and keep selling at yesterday's price, sometimes below
cost. There is no shared record of who changed what, when, or why.

This is a **money** problem: the difference between a viable shop and a failing
one can be a single missed price change on a fast-moving staple like cooking oil.

## The solution

A two-sided tool that closes the loop:

- **Wholesaler side:** paste the message (or import a spreadsheet), let AI
  structure it, **review it**, and publish. One product, one immutable history
  record, targeted notifications.
- **Retailer side:** a clear alert with the **gross-margin impact**, a
  recommended selling price for a target margin, side-by-side supplier
  comparison, inventory, and orders.

## Why it's more than a chatbot wrapper

| Naive approach | PricePulse |
| --- | --- |
| AI guesses the price and publishes it | AI **proposes**; a human **confirms** |
| Invents a date/unit when missing | Reports missing fields; **never fabricates** |
| Blasts everyone | Notifies **only actively connected** retailers, de-duplicated |
| "We'll trust the UI to hide it" | **Server-side RBAC** on every endpoint; no bulk endpoint returns everything |
| "Stock goes up when the order is placed" | Stock goes up **only on receipt confirmation**, exactly once |
| Shows a possibly-wrong "cheapest" | Refuses to compare **incomparable** package sizes |

## Feature highlights

1. **Extract with a safety net.** Live Gemini when a key is present; otherwise a
   strict deterministic parser for English, Burmese and mixed text (including
   Myanmar numerals). The UI always says which path ran.
2. **Human-in-the-loop publishing.** Extraction and import create *pending
   drafts*; publication is a separate, explicit, audited action.
3. **Margin intelligence.** Gross profit and margin before/after, erosion in
   percentage points, and a recommended price (rounded up to the next 100 MMK)
   for a target margin. Clearly labelled *gross*, before operating costs.
4. **Fair supplier comparison.** Unit/package normalisation (1 L = 1000 mL) with
   an honest "not directly comparable" when it isn't.
5. **Idempotent operations.** Price publish and stock receipt are safe to retry;
   the second receipt is rejected.
6. **Bilingual by design.** English + Burmese across the UI, not an afterthought.
7. **Trust surface.** Immutable price history, an append-only audit log, admin
   issued one-time reset tokens (admins never see passwords).

## What is real vs. what is next (honesty)

Judges should be able to trust the claims. So:

**Real and tested today**
- The full workflow, end-to-end, on an isolated demo dataset.
- **60 automated tests** (`npm test`) covering money math, unit comparison,
  untrusted extraction, RBAC, notification de-duplication and exactly-once stock.
- A production build and a live smoke test of the whole path.
- Server-side scrypt auth, opaque session cookies, role-scoped reads.

**Scaffolded, documented, not claimed as working**
- **Firestore adapter** — `firebase.json`, `firestore.rules` (deny-all-by-default)
  and a persistence abstraction are in place; the working store today is the
  server-side file store. Multi-instance safety needs the adapter.
- **Live Gemini extraction** — code path exists; it is untested here because no
  key is configured in this environment.

**Deliberately out of scope for now**
- Rate limiting, SMS/email delivery, and replacing the `xlsx` dependency.

## Impact

For a **retailer**: fewer below-cost sales; a number they can act on; less time
chasing suppliers. For a **wholesaler**: fewer disputes and "nobody told me"
calls; a professional, auditable price book. For the **market**: the beginnings
of a shared, structured price signal where none exists.

## The core belief

The value isn't the AI's cleverness — it's the **discipline around the AI**:
propose, review, confirm, publish one thing, record it immutably, and tell
exactly the right people. That's what makes a pricing tool trustworthy enough to
run a business on.

## Try it

```bash
npm install && npm run dev
# http://localhost:3000 → One-click demo access
```

See [`JUDGE_DEMO_SCRIPT.md`](JUDGE_DEMO_SCRIPT.md) for a 4-minute walkthrough and
[`TEST_EVIDENCE.md`](TEST_EVIDENCE.md) for the proof.
