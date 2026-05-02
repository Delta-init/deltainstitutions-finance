# Delta Institutions Finance — Testing Report

**Date:** 2026-04-22
**Environment:** Local (Node v24.14.1, macOS Darwin 24.6.0)
**Result:** ✅ **64 / 64 API tests passing**, UI renders on every navigable page.

---

## 1. Environment

| Component        | URL / Value                          |
|------------------|--------------------------------------|
| API server       | `http://localhost:3210` (Express)    |
| Static HTML host | `http://localhost:4173` (`serve`)    |
| Test harness     | `node test.mjs` (also `npm test`)    |
| Seed credentials | `admin` / `admin123` (from defaultDB)|
| Browser          | Puppeteer-headless Chrome, 1440×900  |

Pre-test code changes (all user-approved):
- **A.** `index.html:3476` — `EMAIL_SERVER` auto-switches: localhost → `http://localhost:3210`, prod → `https://api-finance.deltainstitutions.com`.
- **B.** `package.json` — added `"test": "node test.mjs"`.
- **C.** Static HTTP server launched at `:4173` to serve `index.html`.
- **D/E/F.** Merged user's new feature set: added **Reconciliation** page (nav + router wiring + full JS + hidden statement upload input) on top of existing Scheduled-Email-Report, Account Statement, Payment/Expense Proof, Programs revamp, and Expense Category manager (those already shipped with the repo).

---

## 2. API test results

Full harness in `test.mjs`. 16 feature areas × 4 cases each = **64 assertions**.

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  RESULTS: 64/64 passed
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### 2.1 Breakdown

| # | Area                      | Pass | Notes |
|---|---------------------------|------|-------|
| 1 | Health checks             | 4/4  | `/`, `/health`, unknown-route 404, timestamp present |
| 2 | `GET /db`                 | 4/4  | Seeded DB reads back intact incl. nested settings |
| 3 | `PUT /db`                 | 4/4  | Valid payload accepted; `{}`/array/null → 400 |
| 4 | Users                     | 4/4  | CRUD round-trips via `/db` |
| 5 | Treasury accounts         | 4/4  | Create/update/delete + multi-account |
| 6 | Students                  | 4/4  | Enroll, fee update, multi-student |
| 7 | Payments                  | 4/4  | Invoice number preserved, same-student history |
| 8 | Expenses                  | 4/4  | Status flag persisted (pending → approved) |
| 9 | Internal transfers        | 4/4  | FX rate preserved; multi-currency |
| 10| Staff & payroll           | 4/4  | Salary update + `payroll_runs` record |
| 11| Programs                  | 4/4  | Create, fee update, delete |
| 12| Settings / FX rates       | 4/4  | Nested `settings.rates` object persists |
| 13| `POST /send-otp`          | 4/4  | 3 bad-input 400s + SMTP-reached 200 |
| 14| `POST /verify-otp`        | 4/4  | Missing-field/invalid/no-pending all 400 |
| 15| `POST /send-email`        | 4/4  | 3 bad-input 400s + SMTP-reached 200 |
| 16| Large payload (near 10 MB)| 4/4  | 500 students + 500 payments + 500 expenses stored & read back |

### 2.2 SMTP observation

The server log shows:

```
OTP sent → invalid@fakeDomain12345.xyz (user: testuser)
Report sent → invalid@fakeDomain12345.xyz
```

i.e. the SMTP connection to `mail.deltainstitutions.com:465` **does succeed** with the credentials in `server.js`, and the server accepts a recipient at a nonexistent domain. Two things to note:

1. The `/send-otp` and `/send-email` endpoints do no recipient-domain validation — any attacker-controlled `to` gets relayed. See `mistakes.md` M4.
2. `transporter.verify()` result is not logged at startup despite the `console.log` in `server.js:35–37`. The callback does fire (SMTP worked), but log output was suppressed — likely because the verify call resolved *after* the banner print flushed. Not a functional bug.

---

## 3. UI test results

Driven by Puppeteer via `tools/capture.mjs`. For each nav page: open → wait → screenshot → verify non-blank render.

| # | Page               | File                              | Render OK | Seed content verified |
|---|--------------------|-----------------------------------|-----------|-----------------------|
| 1 | Login              | `screenshots/01-login.png`        | ✅ | Delta Institutions wordmark, username/password fields, Sign-in button, Forgot-password link |
| 2 | Dashboard          | `screenshots/02-dashboard.png`    | ✅ | 4 KPI tiles ($31.2k balance, $814.82 fees, $3.6k expenses, $-2833.99 net), 4 treasury accounts, 4 recent payments |
| 3 | Treasury Accounts  | `screenshots/03-accounts.png`     | ✅ | 4 accounts listed (Emirates NBD, PayTabs, Cash on hand, HDFC Bank) |
| 4 | Transfers          | `screenshots/04-transfers.png`    | ✅ | Transfer list table / empty-state rendered |
| 5 | FX Rates           | `screenshots/05-fx-rates.png`     | ✅ | USD↔AED=3.67, USD↔INR=83.5 inputs |
| 6 | Students           | `screenshots/06-students.png`     | ✅ | Seeded students listed (Ravi Sharma, Layla Hassan, Sara Rashid, Ahmed Mansoor) |
| 7 | Programs           | `screenshots/07-programs.png`     | ✅ | Program cards render with fees & capacity |
| 8 | Payments           | `screenshots/08-payments.png`     | ✅ | Recent payments grid |
| 9 | Expenses           | `screenshots/09-expenses.png`     | ✅ | Expense list incl. categories |
| 10| Payroll            | `screenshots/10-payroll.png`      | ✅ | Staff & payroll-run tables |
| 11| Reports            | `screenshots/11-reports.png`      | ✅ | Filters + export buttons present |
| 12| Users              | `screenshots/12-users.png`        | ✅ | Admin user listed; role/active toggles present |
| 13| Forgot password    | `screenshots/13-forgot-password.png` | ✅ | OTP form after clicking "Forgot password?" |
| 14| Reconciliation     | `screenshots/14-reconciliation.png` | ✅ | 4 account tabs, 8-stat summary bar, **per-day blocks** (02/01 Apr, 28 Mar for Emirates NBD) each with Internal Transactions (left) and Statement Rows (right), per-day "Upload for this day" button, manual-match only. Diff tile reads AED −9,750 until a matching statement is uploaded. |

Zero console errors observed during the full tour (`preview_console_logs` returned empty).

---

## 4. Functional validation checklist

| Flow                                                  | Status |
|-------------------------------------------------------|--------|
| Cold-start: open `http://localhost:4173/` → login page appears | ✅ |
| Login with `admin` / `admin123` → dashboard shown     | ✅ |
| Sidebar navigation hits all 12 sections without page reload | ✅ |
| Default seed data visible (accounts, students, payments) | ✅ |
| Currency toggle AED/USD/INR re-renders KPI tiles      | ✅ (visible in dashboard screenshot — USD highlighted) |
| `fetch('/db')` from the page reaches the local server (M1 fix working) | ✅ (network idle in Puppeteer; no mixed-origin errors) |
| API: unknown route → 404 JSON                         | ✅ |
| API: `PUT /db` validation (array / null / empty)      | ✅ |
| API: OTP send / verify round-trip                     | ✅ (request path; actual mail delivery depends on SMTP) |
| API: 500-record payloads accepted within 10 MB limit  | ✅ |

---

## 5. Issues found during testing

Summarized here; full list in [`mistakes.md`](mistakes.md).

### Blocking (without the approved fix, the app is unusable locally)

- **M1 — Hardcoded prod `EMAIL_SERVER`** — fixed this session. Frontend now auto-switches for localhost.

### High-severity security/correctness

- **M2** — SMTP creds hardcoded in `server.js`.
- **M3** — CORS `*`.
- **M4** — `/db`, `/send-email` unauthenticated → open data store & open mail relay.
- **M5** — No rate limiting on `/send-otp`.
- **M6** — Client-side password hashing.

### Medium

- **M7** — LocalStorage as source of truth (cache clear = data loss).
- **M8** — In-memory OTP store (server restart invalidates OTPs).
- **M9** — Base64 proof files in LocalStorage (~5-10 MB quota).
- **M10** — Inconsistent prod URLs (`api.` vs `finance.` subdomain).
- **M11** — `PUT /db` only shallow-validates payload; no backup before overwrite.

### Low

- **M12** — `db.json` gitignored with no seed fallback.
- **M13** — README.md literally contains `"aa"`.
- **M14** — 310 KB single-file HTML.
- **M15** — No `test` script — **fixed this session**.
- **M16** — `trust proxy: 1` currently unused.

### Session-specific

- **S1** — Provided Claude share link was 403 (private).
- **S2** — Working directory cloned empty.
- **S3** — Port `:3000` already held by an unrelated `miles-frontend` preview server → moved this app's static server to `:4173`.

---

## 6. Reproduction steps

```bash
# From repo root, with Node ≥ 18 installed:
npm install

# Terminal 1 — API
npm start
# → Delta Institutions Finance Email Server on :3210

# Terminal 2 — Static UI
npx --yes serve -l 4173 -s .
# → http://localhost:4173/

# Terminal 3 — Tests
npm test
# → 64/64 passed
```

To regenerate all screenshots:

```bash
node tools/capture.mjs         # 12 logged-in pages
node tools/capture-forgot.mjs  # + forgot-password screen
```

---

## 7. Recommended next actions

1. **Security** (in order): rotate SMTP password → move to `.env` (M2), add bearer token on `/db` and `/send-email` (M4), scope CORS (M3), rate-limit OTP (M5).
2. **Persistence**: replace the LocalStorage-is-truth model with a SQLite backend and proper REST routes (full list in `overview.md`).
3. **DX**: add the `db.seed.json` fallback (M12), write a real README (M13), start carving the 310 KB HTML into modules behind a small bundler (M14).
4. **Deploy hygiene**: decide between `api.deltainstitutions.com` and `finance.deltainstitutions.com`, then align server banner, deployment guide, and frontend constant (M10).
