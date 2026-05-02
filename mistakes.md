# Mistakes, Bugs, and Lessons Learned

A living log of issues discovered while setting up, analyzing, and running Delta Institutions Finance. Each entry: **what**, **where**, **why it matters**, **proposed fix**. Items marked ⏳ are pending approval; ✅ are fixed; 🚫 are known-but-not-fixing.

---

## M1 — Frontend hardcoded to production email server ✅

- **Was:** `index.html:3476` hardcoded `const EMAIL_SERVER = "https://finance.deltainstitutions.com";` — localhost previews couldn't reach `http://localhost:3210`.
- **Fixed this session:** replaced with a `location.hostname`-aware auto-switch. Production URL is now `https://api-finance.deltainstitutions.com` per user direction.
- **Status:** ✅ shipped.

## M2 — SMTP credentials hardcoded in source

- **Where:** `server.js:27–30`
  ```js
  auth: { user: 'no-replay@deltainstitutions.com', pass: '123#DeltaInstitutions_' }
  ```
- **Why it matters:** Password is in the git repo — anyone with clone access can send email as `no-replay@deltainstitutions.com`. Rotation requires a code change.
- **Proposed fix:** Move to `.env` with `dotenv`; read `process.env.SMTP_USER` / `SMTP_PASS`. Rotate the password after migration.

## M3 — CORS is wildcard (`*`)

- **Where:** `server.js:49`
- **Why it matters:** Any website can call the API from a user's browser session. Combined with unauthenticated `/db` and `/send-email`, this is a significant abuse vector (spam, data tampering).
- **Proposed fix:** Whitelist only `https://finance.deltainstitutions.com` (prod) and `http://localhost:3000` / `file://` for dev.

## M4 — `/db` and `/send-email` have no authentication

- **Where:** `server.js:154`, `server.js:116`, `server.js:160`
- **Why it matters:** `PUT /db` with any JSON object overwrites all academy data. `POST /send-email` allows anyone to send arbitrary email from `no-replay@deltainstitutions.com` (subject/body attacker-controlled) — classic open relay.
- **Proposed fix:** Require a bearer token (env var `API_TOKEN`) on mutating endpoints; limit `/send-email` `to:` to an allow-list or require auth.

## M5 — No rate limiting on `/send-otp`

- **Where:** `server.js:59`
- **Why it matters:** Unlimited OTP spam — can exhaust SMTP quota or flood a victim's inbox.
- **Proposed fix:** Add `express-rate-limit` — e.g. max 5 requests / 10 min per IP per username. `trust proxy` is already set, so rate-limiter will see real IPs.

## M6 — Password hashing is client-side

- **Where:** `index.html` — `simpleHash()` (browser)
- **Why it matters:** Hashing in the browser does not protect anything — anyone inspecting LocalStorage sees the hash, and the algorithm is known-weak. Real auth must be server-enforced (bcrypt/argon2 with server-side verification).
- **Proposed fix:** Move auth + password hashing to the server once a real DB is added; use `bcrypt`.

## M7 — Primary state lives in LocalStorage only

- **Why it matters:** Clearing browser cache wipes the entire academy's ledger (students, payments, expenses, payroll). No multi-user consistency either — two admins on two machines see divergent books.
- **Proposed fix:** Migrate to SQLite (or the JSON `/db` endpoint at minimum) as the source of truth; see `overview.md` for the full REST surface required.

## M8 — OTP store is in-memory

- **Where:** `server.js:40` (`const otpStore = new Map()`)
- **Why it matters:** Server restart invalidates every pending OTP; horizontally scaling the server breaks verification (a request may hit a different instance).
- **Proposed fix:** Redis, or persist to `db.json` with TTL sweeping. Acceptable for a single-node dev setup.

## M9 — Payment / expense proofs stored as base64 in LocalStorage

- **Where:** `savePayment()`, `saveExpense()` (index.html)
- **Why it matters:** Base64 image payloads bloat LocalStorage quickly; browsers enforce a ~5–10 MB quota. ~50 proofs can push the app over the cliff.
- **Proposed fix:** Upload to the server (`POST /uploads`) and store only a URL.

## M10 — Inconsistent production URLs ⏳

- **Where:**
  - `server.js:181` — banner prints `Live: https://api.deltainstitutions.com`
  - `DEPLOYMENT_GUIDE.txt` — same (`api.deltainstitutions.com`)
  - `index.html:3476` — now points to `https://api-finance.deltainstitutions.com` (user's chosen prod URL)
- **Why it matters:** The frontend now targets `api-finance.deltainstitutions.com`, but the server banner and deployment guide still say `api.deltainstitutions.com`. Only one subdomain can be the real API host.
- **Proposed fix:** Update `server.js:181` banner + `DEPLOYMENT_GUIDE.txt` to `api-finance.deltainstitutions.com` (or change the frontend if the canonical host is `api.deltainstitutions.com`). Not fixed this session — needs user decision on the canonical subdomain.

## M11 — `PUT /db` only validates "is a non-empty plain object"

- **Where:** `server.js:160–171`
- **Why it matters:** Any malformed payload shaped like `{foo: "bar"}` passes validation and overwrites valid data. No schema check, no backup, no diff.
- **Proposed fix:** At minimum, back up the previous file (`db.json.bak`) before each write. Ideally validate top-level keys.

## M12 — `db.json` is in `.gitignore` but also the whole persistence layer

- **Where:** `.gitignore`
- **Why it matters:** Not a bug, but means a fresh clone has no seed data; first-run UX is "everything empty." Note alongside the setup instructions.
- **Proposed fix:** Ship a `db.seed.json` that the server falls back to when `db.json` doesn't exist.

## M13 — README.md is empty (contains "aa")

- **Where:** `README.md`
- **Why it matters:** No onboarding info for new devs; `overview.md` and `DEPLOYMENT_GUIDE.txt` exist but aren't discoverable from the landing file.
- **Proposed fix:** Populate README with a quick-start, link to `project.md`, `features.md`, `api.md`.

## M14 — 310 KB single-file HTML

- **Why it matters:** Hard to review in PRs (huge diffs), can't unit-test individual modules, no tree-shaking, no code splitting. Every edit touches one file.
- **Proposed fix (long-term):** Break into ES modules; introduce a minimal bundler (esbuild/Vite). Not urgent while the app is small-team internal-only.

## M15 — No `test` script in package.json

- **Where:** `package.json:7–9`
- **Why it matters:** `test.mjs` exists and is a solid smoke test but is not wired to `npm test`.
- **Proposed fix:** Add `"test": "node test.mjs"`. Trivial.

## M16 — `trust proxy: 1` set but unused

- **Where:** `server.js:51`
- **Why it matters:** Does nothing today (no rate-limit, no IP logging). Harmless but misleading.
- **Proposed fix:** Leave in place if M5 is addressed (rate-limiter will need it). Otherwise remove.

---

## M17 — Reconciliation page was missing from router wiring

- **Where:** `index.html` — original had 12 nav items; pasted version added a 13th (Reconciliation).
- **Why it matters:** Clicking the new nav item would leave the content pane blank (or fail silently) because `PAGE_LABELS`, `PAGE_ACTIONS`, the `fns` map in `renderCurrentPage()`, and the `actions` map in `topbarAction()` didn't include `reconciliation`. The `#stmt-upload-input` hidden element was also absent.
- **Fixed this session:** added `reconciliation: "Reconciliation"` to `PAGE_LABELS`, `reconciliation: "↑ Upload statement"` to `PAGE_ACTIONS`, `reconciliation: reconciliationPage` to the `fns` map, `reconciliation: () => triggerStatementUpload()` to the `actions` map, plus the full `reconciliationPage()` + helpers (`getAccountTransactions`, `buildDailyBreakdown`, `parseStatementCSV`, `parseFlexDate`, `autoMatchAll`, `modalMatchTxn`, `confirmManualMatch`, `ignore/unmatch/deleteReconRow`, `exportReconCSV`) and the hidden `<input id="stmt-upload-input">`.
- **Status:** ✅ shipped.

## M18 — Reconciliation reworked: manual-only + per-day segregated storage ✅

- **Was:** `DB.reconciliations[accountId]` was a flat array of all statement rows; `autoMatchAll()` ran automatically after every upload; the page rendered one global "Daily transactions" table and one "Bank statement rows" table side by side.
- **Why it changed (user feedback):** auto-matching produced false positives and obscured intent; operators wanted each day's internal txns and each day's uploaded rows to live together in one block, with matching done row-by-row.
- **Fixed this session:**
  - Removed `autoMatchAll()` entirely. No code path ever sets a row's `status` to `matched` without a human click.
  - Storage is now `{ "YYYY-MM-DD": [rows] }` per account. A legacy-array sweep runs at the top of `reconciliationPage()` to auto-wipe any old flat-array data.
  - Helpers added: `getAllStmtRows(accountId)` for summary/CSV, `findStmtRow(accountId, rowId)` for bucketed update/delete.
  - `reconciliationPage()` renders one card per date (descending) with Internal (left) and Statement rows (right); per-day "Upload for this day" button forces rows into that date; global bulk upload still files by row's own date.
  - All mutating helpers (`ignoreReconRow`, `unmatchReconRow`, `deleteReconRow`, `modalMatchTxn`, `confirmManualMatch`, `exportReconCSV`) rewritten to read/write the new shape.

## Setup-time mistakes encountered in *this* session

| # | What happened | Recovery |
|---|---------------|----------|
| S1 | The Claude share link the user provided (`2d8e6af7-…`) returned 403 — private share, not readable. | Proceeded without it; confirmed with user. |
| S2 | Initial working directory was empty; had to clone into `.` rather than default `DeltaInstitutions_finance/` subfolder. | Used `git clone <url> .` — fine. |
| S3 | Tried to preview the HTML from `file://` — fetches to `http://localhost:3210` will be blocked by browser CORS (mixed origin). | To be addressed by serving `index.html` over an HTTP static server *and* changing `EMAIL_SERVER` (see M1). |
