# CI/CD, Custom Domain & Feedback — Setup Runbook

Operator guide for the three enhancements requested for the Delivery Optimizer.
Everything that can be done from the app/GCP data-plane is already in place; the
steps below require **`benevolentbandwidth` org-owner rights** (GitHub app/repo
authorization) or resources this repo's contributors can't create directly.

## Environment (discovered)

| Thing | Value |
|---|---|
| GCP project | `b2-delivery-optimizer` (Firebase-enabled) |
| Backend (C++ API) | Cloud Run `deliveryoptimizer` @ `us-east1` → `https://deliveryoptimizer-5ts7ho5rla-ue.a.run.app` |
| Frontend (Next.js) | Firebase **App Hosting** backend `delivery-optimizer` @ `us-east4` → `delivery-optimizer--b2-delivery-optimizer.us-east4.hosted.app`, root dir `app/ui` |
| Build SA | `do-app-service@b2-delivery-optimizer.iam.gserviceaccount.com` |
| App Hosting compute SA | `firebase-app-hosting-compute@b2-delivery-optimizer.iam.gserviceaccount.com` |
| Cloud Build GitHub connections (exist, COMPLETE) | `B2-Delivery-Optimizer`, `Delivery_Optimizer` @ `us-east1` |
| Backend build/deploy recipe | `cloudbuild.yaml` (repo root) — builds+pushes API & OSRM images, `gcloud run services replace` |

---

## 1) CI/CD

Today both sides are deployed **manually**. There are **0 Cloud Build triggers**, and
the App Hosting backend has **no connected repo** (deploys were `cli-firebase`).

### 1a. Backend → Cloud Build trigger (recommended)

The heavy C++ build already works via `cloudbuild.yaml` on Cloud Build's 8-CPU
machine. It just needs a push trigger. The GitHub↔GCP connection already exists
and is `COMPLETE`; the only missing piece is **repo authorization** (linking the
repo needs GitHub *admin*, which the connection's authorizing user lacks).

**Owner step (one-time, ~2 min):** authorize the repo on the existing connection:
Cloud Build → Repositories → connection `B2-Delivery-Optimizer` →
*Link repository* → grant the Google Cloud Build GitHub app access to
`benevolentbandwidth/delivery-optimizer`.
(Console: `https://console.cloud.google.com/cloud-build/repositories/2nd-gen?project=b2-delivery-optimizer`)

**Then (someone with `cloudbuild.builds.editor` + `cloudbuild.connectionAdmin`, e.g. me):**

```bash
gcloud builds repositories create delivery-optimizer \
  --remote-uri=https://github.com/benevolentbandwidth/delivery-optimizer.git \
  --connection=B2-Delivery-Optimizer --region=us-east1 --project=b2-delivery-optimizer

gcloud builds triggers create github \
  --name=deploy-backend-main --region=us-east1 --project=b2-delivery-optimizer \
  --repository=projects/b2-delivery-optimizer/locations/us-east1/connections/B2-Delivery-Optimizer/repositories/delivery-optimizer \
  --branch-pattern='^main$' \
  --build-config=cloudbuild.yaml
```

`cloudbuild.yaml` already pins `serviceAccount: do-app-service@…` and
`logging: CLOUD_LOGGING_ONLY`, so no extra trigger flags are needed.

> Shortcut: grant `eman-cickusic` **Admin** on the repo and the entire link +
> trigger creation can be scripted with no console step.

### 1b. Frontend → App Hosting auto-deploy

App Hosting deploys on push once the repo is connected.

**Owner step (one-time):** Firebase Console → App Hosting → backend
`delivery-optimizer` → **Connect to GitHub** → repo
`benevolentbandwidth/delivery-optimizer`, live branch `main`, root directory
`app/ui`. Every push to `main` then auto-creates a rollout.

---

## 2) Custom domain — DEFERRED (blocked)

`delivery-optimizer.benevolentbandwidth.com` can't be configured yet:
**`benevolentbandwidth.com` is not registered/delegated** (NXDOMAIN at the `.com`
registry as of 2026-07-13). A custom domain requires the apex domain to resolve first.

When the domain is live:
1. Firebase Console → App Hosting → `delivery-optimizer` → **Add custom domain** →
   `delivery-optimizer.benevolentbandwidth.com`.
2. App Hosting shows the required **A/AAAA** records + a **TXT** ownership record.
3. Add those at whatever controls `benevolentbandwidth.com` DNS, then click Verify.

---

## 3) Feedback → GitHub issue

Code is complete and shipped (`app/ui/src/lib/feedback/*`, API `app/ui/src/app/api/feedback/route.ts`,
UI `FeedbackLauncher` mounted in `layout.tsx`). It uses a **GitHub App** (JWT →
installation token → create issue), with honeypot, per-IP rate limiting, and a
daily-shutdown guard already active. Only real credentials/secrets are missing —
all `FEEDBACK_*` secrets currently hold the literal `"placeholder"`.

Already done in this change:
- `FEEDBACK_GITHUB_REPO` secret set to `benevolentbandwidth/delivery-optimizer`.
- reCAPTCHA env vars removed from `apphosting.yaml` (they were mapped to placeholder
  secrets → would 403 **every** submission). reCAPTCHA is optional; re-enable per the
  comment left in `apphosting.yaml`.

### 3a. Create + install the GitHub App (org owner)

1. `https://github.com/organizations/benevolentbandwidth/settings/apps/new`
   - **Permissions → Repository → Issues: Read and write** (that's the only one needed).
   - Uncheck "Webhook → Active". Homepage URL can be the app URL.
2. Create it → note the **App ID**.
3. **Generate a private key** → downloads a `.pem`.
4. **Install App** → only `benevolentbandwidth/delivery-optimizer` → note the
   **Installation ID** (the number in the install settings URL, or
   `gh api /orgs/benevolentbandwidth/installations`).

### 3b. Populate secrets (needs `secretmanager.versions.add` — I have it)

```bash
P=b2-delivery-optimizer
printf '<APP_ID>'          | gcloud secrets versions add FEEDBACK_GITHUB_APP_ID          --data-file=- --project=$P
printf '<INSTALLATION_ID>' | gcloud secrets versions add FEEDBACK_GITHUB_INSTALLATION_ID --data-file=- --project=$P
gcloud secrets versions add FEEDBACK_GITHUB_PRIVATE_KEY --data-file=./your-app.private-key.pem --project=$P
```

### 3c. Screenshots (optional — needs `storage.buckets.create`, owner)

Text + browser diagnostics work without this. To also accept screenshot uploads:

```bash
P=b2-delivery-optimizer; B=b2-delivery-optimizer-feedback-screenshots
gcloud storage buckets create gs://$B --project=$P --location=us-east4 --uniform-bucket-level-access
gcloud storage buckets add-iam-policy-binding gs://$B \
  --member=serviceAccount:firebase-app-hosting-compute@$P.iam.gserviceaccount.com \
  --role=roles/storage.objectAdmin
printf "$B" | gcloud secrets versions add FEEDBACK_SCREENSHOT_BUCKET --data-file=- --project=$P
```

### 3d. Roll out

Ensure the compute SA can read the secrets, then redeploy so new values load:

```bash
firebase apphosting:secrets:grantaccess FEEDBACK_GITHUB_APP_ID,FEEDBACK_GITHUB_INSTALLATION_ID,FEEDBACK_GITHUB_PRIVATE_KEY,FEEDBACK_GITHUB_REPO,FEEDBACK_SCREENSHOT_BUCKET \
  --backend delivery-optimizer --project b2-delivery-optimizer
firebase apphosting:rollouts:create delivery-optimizer --git-branch main --project b2-delivery-optimizer
```

**Verify:** open the app → "Report bug / feedback" → submit → a new issue appears
in `benevolentbandwidth/delivery-optimizer/issues` and the panel links to it.
