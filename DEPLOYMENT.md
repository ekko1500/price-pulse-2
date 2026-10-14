# Deploying PricePulse Myanmar

A complete, ordered guide: create the Firebase project, set the variables, and
deploy the static frontend to **Firebase Hosting** and the API to **Cloud Run**.

```
Browser ──▶ Firebase Hosting  (static frontend: out/)   → https://<project>.web.app
              │  rewrite /api/**  →
              ▼
           Cloud Run (Next.js API from the Dockerfile)   → https://pricepulse-api-<hash>-us-central1.a.run.app
              ├─ Cloud Firestore   (data)
              ├─ Firebase Storage  (centralised reference thumbnails)
              └─ Google Gemini     (supplier-message extraction + image moderation)
```

Two deployables share one repo:

- **Backend** = `npm run build` (standalone) → Docker image → **Cloud Run**.
- **Frontend** = `npm run build:web` (static export → `out/`) → **Firebase Hosting**.

The browser only ever calls `/api/...` on the Hosting domain; Hosting proxies to
Cloud Run, so the session cookie stays **same-origin** (no CORS, no `SameSite`).

> **Defaults used here:** region **`us-central1`** (the low-friction default that
> Firebase Hosting `run` rewrites and Cloud Run both support), **Secret Manager**
> for the two secrets, and **one project** for Hosting + Cloud Run.

---

## Checklist

- [ ] Firebase project with **Firestore** (native), **Storage** and **Hosting**.
- [ ] Firebase **service-account key** (Project settings → Service accounts → Generate new private key).
- [ ] **Web app** registered in the Firebase project (for `NEXT_PUBLIC_FIREBASE_*`).
- [ ] **Gemini API key** from <https://aistudio.google.com/apikey>.
- [ ] Google Cloud project (same as Firebase) with billing + `gcloud` CLI.

---

## 1. Create the Firebase project (console)

1. Firebase console → **Add project**. Note the **Project ID** (e.g. `pricepulse-demo`).
2. **Build → Firestore Database → Create database** → *Native mode* → choose a region.
3. **Build → Storage → Get started** → use the default bucket. Copy the **bucket
   name** shown (either `<project>.appspot.com` or `<project>.firebasestorage.app`).
4. **Build → Hosting → Get started** (just provisions it).
5. **Project settings → Service accounts → Generate new private key** → download
   the JSON. You will use its `project_id`, `client_email`, `private_key`.
6. **Project settings → General → Your apps → Web app (`</>`)** → register one and
   copy the `firebaseConfig` values (apiKey, authDomain, projectId, storageBucket,
   appId, messagingSenderId).

---

## 2. The variables — what goes where

There are two groups. The single most common mistake is putting them in the wrong
place.

### A) Server variables → Cloud Run (env + secrets)

| Variable | Needed for | Value |
| --- | --- | --- |
| `FIREBASE_PROJECT_ID` | Firestore + Storage | from the service-account JSON |
| `FIREBASE_CLIENT_EMAIL` | Firestore + Storage | from the service-account JSON |
| `FIREBASE_PRIVATE_KEY` | Firestore + Storage | **secret**; the JSON `private_key` |
| `FIREBASE_STORAGE_BUCKET` | thumbnails | the bucket name from step 1.3 (set it explicitly) |
| `GEMINI_API_KEY` | AI extraction + moderation | **secret**; AI Studio key |
| `GEMINI_MODEL` | extraction | `gemini-2.5-flash-lite` (optional) |
| `GEMINI_VISION_MODEL` | moderation/tagging | defaults to `GEMINI_MODEL` (optional) |
| `THUMBNAIL_MODERATION` | moderation policy | `lenient` (default) or `strict` (optional) |
| `PRICEPULSE_SESSION_SECRET` | future use | optional, unused today |
| `PRICEPULSE_DATA_DIR` | file store | **not** needed in production |

### B) Frontend variables → the **build environment** (inlined at build time)

`NEXT_PUBLIC_*` values are baked into the static bundle. They are **not** server
secrets and are **not** set on Cloud Run.

| Variable | Value |
| --- | --- |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | from the Web app config |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | from the Web app config |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | from the Web app config |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | from the Web app config (must match the server bucket) |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | from the Web app config |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | from the Web app config |
| `NEXT_PUBLIC_API_BASE_URL` | leave **empty** (same-origin via the Hosting rewrite) |

> **Rule of thumb:** `FIREBASE_*` / `GEMINI_*` → **Cloud Run**.
> `NEXT_PUBLIC_FIREBASE_*` → **frontend build**.

Graceful degradation: with no Firebase the app uses the JSON file store and inline
thumbnails; with no `GEMINI_API_KEY` it uses the deterministic parser and lenient
moderation. So it runs with **zero config** locally.

---

## 3. Local development (do this first)

```bash
npm install
cp .env.example .env.local       # Windows: copy .env.example .env.local
npm run dev                      # http://localhost:3000
```

- Works with an **empty** `.env.local` (demo data, deterministic parser).
- To test AI: add `GEMINI_API_KEY=...`.
- To test Firebase locally: add the `FIREBASE_*` and `NEXT_PUBLIC_FIREBASE_*` values.

`.env.local` is git-ignored, so it is safe for secrets.

---

## 4. Deploy the security rules

```bash
npm i -g firebase-tools
firebase login
firebase use <your-project-id>
firebase deploy --only firestore:rules,storage
```

- `firestore.rules` — deny-all client access (the server, via the Admin SDK, is the only writer).
- `storage.rules` — public read + size/content-type-limited thumbnail creates.

---

## 5. Deploy the backend to Cloud Run

Enable the APIs once (first time):

```bash
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com secretmanager.googleapis.com
```

Store the two secrets (first time). Extract just the `private_key` value from the
service-account JSON:

```bash
gcloud secrets create firebase-private-key --data-file=private_key.txt --replication-policy=automatic
gcloud secrets create gemini-api-key       --data-file=gemini_key.txt  --replication-policy=automatic
```

Deploy (builds from the repo `Dockerfile`, which produces the Next.js standalone server):

```bash
gcloud run deploy pricepulse-api \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --port 3000 \
  --set-env-vars "FIREBASE_PROJECT_ID=<project_id>,FIREBASE_CLIENT_EMAIL=<client_email>,FIREBASE_STORAGE_BUCKET=<bucket>,GEMINI_MODEL=gemini-2.5-flash-lite,THUMBNAIL_MODERATION=lenient" \
  --set-secrets "FIREBASE_PRIVATE_KEY=firebase-private-key:latest,GEMINI_API_KEY=gemini-api-key:latest"
```

Notes:

- Service name **`pricepulse-api`** and region **`us-central1`** must match the
  `run` rewrite in `firebase.json` (edit either side if you change them).
- Cloud Run must be in the **same project** as Hosting for the `run` rewrite.
- `private_key.txt` may contain real newlines or literal `\n` — the app handles both.
- The container listens on `PORT=3000` (the Dockerfile sets this).

---

## 6. Deploy the frontend to Firebase Hosting

Set the six `NEXT_PUBLIC_*` values (in your shell or in `.env.local`), then build
and deploy. `next build` reads `.env.local`, so putting them there also works.

```bash
# bash example — use your Web app config values
export NEXT_PUBLIC_FIREBASE_API_KEY=...
export NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=<project>.firebaseapp.com
export NEXT_PUBLIC_FIREBASE_PROJECT_ID=<project>
export NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=<bucket>
export NEXT_PUBLIC_FIREBASE_APP_ID=...
export NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...

npm run build:web                 # static export → ./out
firebase deploy --only hosting
```

`build:web` temporarily hides `app/api` (the static exporter rejects server
routes), builds `out/`, then restores it — expected and safe.

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

Result:

- **Frontend:** `https://<project>.web.app`
- **Backend:** `https://pricepulse-api-<hash>-us-central1.a.run.app`

---

## 7. Verify end-to-end

1. Open `https://<project>.web.app` → **One-click demo access → Retailer**.
2. **Inventory → image** → submit a reference picture; it uploads to Storage, is
   moderated, and renders from its public URL.
3. Sign in as different personas, downvote the picture 5× → submissions open →
   **suggest a better picture** and confirm the limits / auto-promotion.
4. Wholesaler → **Price update** → pick a model, paste a message, publish.
5. Redeploy the Cloud Run revision → Firestore data and Storage thumbnails survive.

---

## Alternative: call Cloud Run directly (cross-origin)

If you would rather not use the Hosting rewrite, set on the frontend build:

```
NEXT_PUBLIC_API_BASE_URL=https://pricepulse-api-<hash>-us-central1.a.run.app
```

Then you must also:

- add CORS on Cloud Run for `https://<project>.web.app` with
  `Access-Control-Allow-Credentials: true`, and
- set the session cookie to `SameSite=None; Secure` (edit `setSessionCookie`).

The **Hosting rewrite (default) is strongly preferred** — it avoids both.

---

## Troubleshooting

| Symptom | Cause / fix |
| --- | --- |
| `/api/*` returns 404 on `web.app` | The `run` rewrite `serviceId`/`region` doesn't match the Cloud Run service. |
| 401 on every request after login | You're calling Cloud Run cross-origin without `SameSite=None; Secure` + CORS. Use the Hosting rewrite (don't set `NEXT_PUBLIC_API_BASE_URL`). |
| Thumbnail upload fails / "could not be read" | Storage not enabled, or `FIREBASE_STORAGE_BUCKET` ≠ the real bucket name. |
| Thumbnails show as `data:` URLs | Firebase isn't configured (expected locally); set the Firebase env in production. |
| `build:web` fails with "route handlers cannot be exported" | Run `npm run build:web` (it hides `app/api`), not `next build` with `PRICEPULSE_TARGET=web`. |
| Cloud Run container won't start | Ensure `PORT=3000` and the container listens on it (the Dockerfile sets this). |
| Gemini errors | Use a current `GEMINI_MODEL` and check quota; the app falls back automatically. |
| Login works locally but not on `web.app` | The session cookie is `Secure`; production must be HTTPS (Hosting is). |
