# Test Evidence

Everything below is reproducible on a clean checkout with the commands shown.

```
npm test         → 8 files, 60 tests, all passing
npm run typecheck → no errors
npm run lint      → no warnings or errors
npm run build     → compiled successfully
```

The tests target the parts of the system where a mistake is costly: **money
math**, **unit comparison**, **untrusted extraction**, **authorization**, and
**the two workflows that must be exactly-once** (price publish, stock receipt).

---

## 1. `tests/pricing.test.ts` — money math (11 tests)

Deterministic gross-profit / margin / recommended-price calculations.

| Proves | Detail |
| --- | --- |
| Gross margin is correct | 5,600 sell / 5,000 cost → +600 MMK, **10.7%** |
| Negative margin is flagged, not thrown | 5,600 sell / 5,800 cost → **-200 MMK, -3.6%** |
| Division-by-zero is handled | selling price 0 → margin `null`, `isValid:false` |
| Non-finite input rejected | `NaN` / `undefined` → `isValid:false` |
| Recommended price formula | 5,800 / (1 − 0.15) = 6,823.53 → **rounded UP to 6,900** |
| Rounding boundary | 5,000 stays 5,000; 5,001 → 5,100 |
| **Section 9 benchmark** | old 5,000 / new 5,800 / retail 5,600 reproduces **exactly**: before +600 (10.7%), after −200 (−3.6%), erosion **−14.3 pts**, recommended **6,900** |

## 2. `tests/units.test.ts` — fair comparison (7 tests)

| Proves | Detail |
| --- | --- |
| Parses mass / volume / count | `5 kg`, `1 Liter`, `12 pcs` |
| Refuses to guess | unparseable size → `null`, not a guessed value |
| 1 L vs 1000 mL comparable | normalised to a base unit |
| **Unknown size vs 1 L is NOT comparable** | prevents a false "cheaper" claim |
| Different dimensions rejected | mass vs volume |
| Price per base unit | 9,000 / 2 kg → 4.5 MMK/g |

## 3. `tests/extractor.test.ts` — extraction without fabrication (8 tests)

| Proves | Detail |
| --- | --- |
| Myanmar numerals | `၅၈၀၀` → `5800` |
| English "was" ordering | new-first / old-second parsed correctly |
| **No invented dates** | a message with no date leaves `effectiveDate` `undefined` and adds a warning |
| Burmese message | `ဆီ ၁ လီတာ ၅၈၀၀ ကျပ်` → 5,800 |
| Package size ≠ price | "Cooking Oil 1 Liter" is **not** read as a price |
| Ambiguity surfaced | two bare numbers → explicit "please verify" warning |
| `from … to` ordering | previous 5,000, new 5,800 |
| No catalog match | warns instead of silently matching |

## 4. `tests/schema.test.ts` — AI output is untrusted (7 tests)

| Proves | Detail |
| --- | --- |
| Well-formed input accepted | — |
| Script/HTML and overflow rejected | `"1e999"` → 0, missing-price flagged |
| Negative / non-numeric prices rejected | → 0 |
| Unit synonyms normalised | `litres` → `liter`; junk → `''` |
| **Malformed dates dropped** | `next week` and `2026-13-40` → `undefined` |
| Confidence clamped | 5 → 1; −3 → 0 |
| Non-object input safe | `null` → safe empty draft |

## 5. `tests/auth.test.ts` — auth, validation, RBAC (13 tests)

| Proves | Detail |
| --- | --- |
| Password verify | correct accepted, wrong rejected |
| Unique salts | identical passwords hash differently |
| No plaintext | hash does not contain the password |
| Seeded users verify | demo passwords match seeded hashes |
| Phone normalisation | `+95 …` and spaced forms → `09…` |
| Username / password strength | enforced |
| **Calendar-valid dates** | `2026-02-30` rejected |
| **Admin cannot self-register** | role `admin` → validation error |
| Price ceiling | 200,000,000 MMK rejected |
| Retailer scoping | sees only active-connection suppliers |
| Pending connection excluded | retailer-2 does **not** see the pending wholesaler |
| Wholesaler scoping | sees only own products |
| `ownsProduct` / `hasActiveConnection` | correct |

## 6. `tests/pricing-service.test.ts` — publish integrity (4 tests)

| Proves | Detail |
| --- | --- |
| **One product only** | other products' prices unchanged |
| Immutable history | +800 MMK / 16% recorded |
| **Targeted notification** | only actively connected retailers of that wholesaler |
| Pending connection excluded | no notification |
| Invalid price rejected | throws `PricingError` |

## 7. `tests/orders.test.ts` — exactly-once stock + dedupe (8 tests)

| Proves | Detail |
| --- | --- |
| Stock increases on receipt | +24 oil, +10 rice; 2 purchase rows written |
| **Idempotent receipt** | second call → `OrderError` status **409**, stock and purchase rows unchanged |
| Non-party blocked | another retailer cannot confirm |
| Receipt endpoint enforced | `receipt_confirmed` cannot be set via status transition |
| Role-guarded transitions | wholesaler ↔ retailer target rules |
| Invalid transition rejected | e.g. pending → delivered |
| Notification dedupe | same `(recipient, dedupeKey)` created once |

## 8. `tests/store.test.ts` — demo/real isolation (2 tests)

| Proves | Detail |
| --- | --- |
| **Reset preserves real data** | a non-demo user, business and session survive `resetDemo()` |
| Demo restored | demo users back after reset; stray demo draft removed |
| Persistence | dataset written to disk and re-readable |

---

## Live end-to-end smoke test (production build)

Run against `npm run build && npm start`. Result — **all checks passed**:

```
ok  - wholesaler demo login returns a session cookie
ok  - wholesaler bootstrap loads
ok  - bootstrap role is wholesaler
ok  - password hash is NOT exposed to client
ok  - catalog contains the cooking oil product
ok  - price published (5000 -> 5800)
ok  - history records the +800 MMK change
ok  - retailer received a price-change notification
ok  - notification carries correct prices
ok  - retailer selling price is untouched (5600)
ok  - retailer is forbidden from publishing prices (403)
ok  - unauthenticated bootstrap is rejected (401)
ok  - first receipt confirmation succeeds
ok  - second receipt confirmation is rejected (409)
```

This exercises the full path: login → scoped read → publish → targeted
notification → RBAC denial → unauthenticated denial → idempotent receipt.

---

## Bugs found by these tests (and fixed)

Writing the suite surfaced three real defects, which is exactly what a test suite
is for:

1. **`isValidISODate` accepted impossible dates** (`2026-02-30` rolled over in
   `Date`). Fixed to round-trip through `Date.UTC` and compare parts.
2. **`validateExtractedDraft` accepted badly-shaped dates** by regex alone.
   Now uses the same calendar-valid check.
3. **`checkComparability` wrongly treated an unknown package size as comparable**
   to a known one, which could show a misleading "cheapest" label. Fixed to
   require both sizes known-and-equal, or both unknown.
4. **The extractor let a package size become the unit** ("1 Liter" → unit
   `liter`). Fixed so a catalog match is authoritative for the unit.

Each fix has a regression test above.
