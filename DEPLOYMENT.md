# Deploying PricePulse Myanmar

Target stack:

```
Browser
  │
  ▼
Firebase Hosting  (static frontend)      → https://<project>.web.app
  │  rewrite: /api/**  →  Cloud Run
  ▼
Cloud Run  (Next.js API backend)         → https://<service>-<hash>.a.run.app
  ├─ Cloud Firestore   (data)
  ├─ Firebase Storage  (centralised reference thumbnails)
  └─ Google Gemini     (supplier-message extraction)
```

The frontend is a static export deployed to **Firebase Hosting**. The API is the
Next.js server deployed to **Cloud Run**. Hosting **rewrites `/api/**` to Cloud
Run**, so the browser always calls `/api/...` **same-origin** — the session
cookie keeps working with no CORS or `SameSite` changes.

> Cloud Run requires a billing account (Blaze). Firestore and Firebase Storage have free tiers.

---

## What you need from your side (checklist)

- [ ] **Firebase project** with **Cloud Firestore** (native mode), **Storage** and **Hosting** enabled.
- [ ] **Firebase service-account key** (Project settings → Service accounts → Generate new private key).
- [ ] **Google Cloud project** with billing enabled + `gcloud` CLI (for Cloud Run). Same project as Firebase is easiest.
- [ ] **Gemini API key** from <https://aistudio.google.com/apikey>.
- [ ] The Cloud Run **service name and region** — they must match the `run` rewrite in `firebase.json`.

---

## 1. Firestore

1. Firebase console → **Build → Firestore Database → Create database** (native mode).
2. **Project settings → Service accounts → Generate new private key** → download JSON
   (`project_id`, `client_email`, `private_key`).
3. Deploy the (deny-all client) rules — the server bypasses them:
   ```bash
   npm i -g firebase-tools
   firebase login
   firebase use <your-project-id>
   firebase deploy --only firestore:rules
   ```
4. The first request seeds the demo dataset if Firestore is empty.

## 2. Firebase Storage (reference thumbnails)

1. Firebase console → **Build → Storage → Get started** (use the default bucket).
2. The backend uses the same **service account** as Firestore, so no extra keys are needed.
   The bucket defaults to `<project>.appspot.com`; override with `FIREBASE_STORAGE_BUCKET` if yours differs.
3. Thumbnails are written with a public **download token**, so no bucket-level public
   access or CORS configuration is required (uploads go through the API, not the browser).

## 3. Gemini

1. <https://aistudio.google.com/apikey> → **Create API key**.
2. Use a current model — the retired `gemini-1.5-flash` no longer works
   (`GEMINI_MODEL=gemini-2.5-flash-lite`). Wholesalers can also pick a model in the UI.

---

## 4. Deploy the backend to Cloud Run

The repo ships a `Dockerfile` that builds the Next.js **standalone** server.

```bash
gcloud run deploy pricepulse-api \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --port 3000 \
  --set-env-vars "GEMINI_MODEL=gemini-2.5-flash-lite,FIREBASE_STORAGE_BUCKET=<project>.appspot.com" \
  --set-env-vars "FIREBASE_PROJECT_ID=<project_id>,FIREBASE_CLIENT_EMAIL=<client_email>" \
  --set-secrets "FIREBASE_PRIVATE_KEY=firebase-private-key:latest,GEMINI_API_KEY=gemini-api-key:latest"
```

Notes:
- Create the Secret Manager entries first, e.g.:
  `printf '%s' "$PRIVATE_KEY" | gcloud secrets create firebase-private-key --data-file=-`
  (store the private key with real newlines or literal `\n` — the app converts `\n`).
- `--source .` uses the repo `Dockerfile` automatically.
- The service name **`pricepulse-api`** and region **`us-central1`** must match
  the `run` rewrite in `firebase.json` (edit either to suit).

Alternatively deploy via the Cloud Run console (build from the connected repo).

## 5. Deploy the frontend to Firebase Hosting

```bash
npm run build:web          # static export → ./out
firebase deploy --only hosting
```

`build:web` builds the same codebase in static-export mode (it temporarily hides
the server-only API routes, which the static exporter rejects) and writes `out/`.
Firebase Hosting serves `out/` and rewrites `/api/**` to Cloud Run.

`firebase.json` already contains the wiring:

```json
{
  "hosting": {
    "public": "out",
    "cleanUrls": true,
    "rewrites": [
      { "source": "/api/**", "run": { "serviceId": "pricepulse-api", "region": "us-central1" } },
      { "source": "**", "destination": "/index.html" }
    ]
  }
}
```

You'll get:
- **Frontend:** `https://<project>.web.app`
- **Backend:** `https://pricepulse-api-<hash>-<region>.a.run.app`

## 6. Verify

1. Open `https://<project>.web.app` → **One-click demo access → Retailer**.
2. **Inventory → image** → submit a reference picture; it uploads to Firebase Storage and renders from its public URL.
3. Vote it down (as different personas) until submissions open, then **suggest a better picture** and confirm the limits/auto-promotion.
4. Wholesaler → **Price update** → pick a model, paste a message, confirm the draft.
5. Redeploy the Cloud Run revision → Firestore data and Storage thumbnails survive.

---

## Alternative: call Cloud Run directly (cross-origin)

If you'd rather not use the Hosting rewrite, set on the frontend build:

```
NEXT_PUBLIC_API_BASE_URL=https://pricepulse-api-<hash>-<region>.a.run.app
```

Then you must also:
- add CORS on Cloud Run for `https://<project>.web.app` with `Access-Control-Allow-Credentials: true`, and
- set the session cookie to `SameSite=None; Secure` (edit `setSessionCookie`).

The **Hosting rewrite (default) is strongly preferred** — it avoids both.

---

## Troubleshooting

| Symptom | Cause / fix |
| --- | --- |
| 401 on every request after login | You're calling Cloud Run cross-origin without `SameSite=None; Secure` cookies + CORS. Use the Hosting rewrite, or apply the "Alternative" section. |
| `/api/*` returns 404 on `web.app` | The `run` rewrite service/region doesn't match your Cloud Run service. |
| Thumbnail upload fails | Firebase Storage not enabled, or `FIREBASE_STORAGE_BUCKET` points at the wrong bucket. |
| Thumbnails stored inline (`data:` URLs) | Firebase isn't configured — expected locally; set the Firebase env vars in production. |
| Static build fails with "route handlers cannot be exported" | Run `npm run build:web` (it hides `app/api`), not `next build` with `PRICEPULSE_TARGET=web` directly. |
| Cloud Run container won't start | Ensure `PORT=3000` and the container listens on it (the Dockerfile sets this). |
| Gemini errors | Use a current `GEMINI_MODEL` and check quota; the app falls back to the deterministic parser. |

## Local development

`npm run dev` runs the frontend **and** API together on one origin — no rewrite
or CORS needed locally.
