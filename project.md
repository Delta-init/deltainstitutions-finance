# Delta Institutions — Finance Manager

## 1. Project Summary

A single-tenant internal finance management dashboard for Delta Institutions. It tracks students, programs, fees, treasury accounts (bank/PSP/cash/exchanger), expenses, payroll, inter-account transfers, and FX-converted totals across USD/AED/INR. All operational data lives in the browser's LocalStorage; a small Node.js email-server handles password-reset OTPs and ad-hoc report emails.

## 2. Architecture at a Glance

```
┌─────────────────────────────────────────────────────────┐
│  Browser — index.html (310KB, vanilla HTML/CSS/JS SPA)  │
│  ├─ All UI pages (dashboard, treasury, students, …)     │
│  ├─ State: window.localStorage (users, accounts, …)     │
│  └─ Calls EMAIL_SERVER for OTP / send-email / /db       │
└───────────────┬─────────────────────────────────────────┘
                │ HTTP (fetch)
                ▼
┌─────────────────────────────────────────────────────────┐
│  Node.js — server.js (Express 4) on :3210               │
│  ├─ OTP store: in-memory Map (15-min GC)                │
│  ├─ JSON DB:   db.json (read/write via /db)             │
│  └─ SMTP:      nodemailer → mail.deltainstitutions.com:465     │
└─────────────────────────────────────────────────────────┘
```

| Layer       | Technology                          | Persistence                             |
|-------------|-------------------------------------|-----------------------------------------|
| UI          | Static HTML + vanilla JS (one file) | —                                       |
| App state   | `localStorage`                      | Per-browser, cleared on cache clear     |
| Server API  | Node 18+/Express 4, ES modules      | —                                       |
| Shared DB   | `db.json` (optional, via /db)       | Local file on the server machine        |
| Email       | Nodemailer → SMTP 465/TLS           | External (deltainstitutions.com mail server)   |

## 3. Tech Stack

- **Runtime:** Node.js ≥ 18 (tested on v24.14.1)
- **Frontend:** Plain HTML5, CSS custom properties, vanilla JS; Google Fonts (DM Sans / DM Mono)
- **Backend deps:** `express` ^4.18.2, `cors` ^2.8.5, `nodemailer` ^6.9.7
- **Dev deps:** none (no bundler, no TypeScript, no linter)
- **Test harness:** `test.mjs` — homegrown async script using native `fetch`
- **Module system:** `"type": "module"` (ESM)

## 4. Source Tree

```
deltainstitutionsfinance/
├── index.html              # entire SPA (310 KB)
├── server.js               # Express email + JSON-DB server
├── package.json            # deps + "start" script
├── test.mjs                # end-to-end API tests (hits localhost:3210)
├── overview.md             # upstream overview (pre-existing)
├── DEPLOYMENT_GUIDE.txt    # cPanel deployment notes
├── README.md               # stub ("aa")
└── .gitignore              # excludes node_modules, package-lock.json, db.json, nginx.conf
```

## 5. Data Model

**Server-side (db.json)** — a single JSON object. Expected top-level keys (loosely typed):

| Key         | Shape                                                                  |
|-------------|------------------------------------------------------------------------|
| `users`     | `[{id, username, email, role, password_hash, active}]`                 |
| `accounts`  | `[{id, name, type:'bank'\|'psp'\|'cash'\|'exchanger', balance, currency}]` |
| `students`  | `[{id, name, email?, phone?, program_id, fee, currency}]`              |
| `programs`  | `[{id, name, fee, currency, schedule, capacity}]`                      |
| `payments`  | `[{id, student_id, account_id, amount, currency, date, proof?}]`       |
| `expenses`  | `[{id, category_id, account_id, amount, currency, status, proof?, date}]` |
| `transfers` | `[{id, from_account_id, to_account_id, amount, fx_rate, date}]`        |
| `staff`     | `[{id, name, role, salary, currency, account_id}]`                     |
| `payroll`   | `[{id, month, total, currency, account_id, run_at}]`                   |
| `settings`  | `{academyName, rates:{usdAed, usdInr}}`                                |

Note: the browser still keeps a parallel copy of this data in `localStorage`. `/db` is effectively a backup/sync endpoint — it is not transactional.

## 6. Configuration

There is **no `.env` file**. All configuration lives inline in `server.js`:

| Setting        | Value                          | Location            |
|----------------|--------------------------------|---------------------|
| Port           | `3210`                         | `server.js:20`      |
| SMTP host      | `mail.deltainstitutions.com:465`      | `server.js:24–25`   |
| SMTP user      | `no-replay@deltainstitutions.com`     | `server.js:28`      |
| SMTP pass      | `123#DeltaInstitutions_` (hardcoded!) | `server.js:29`      |
| CORS origin    | `*`                            | `server.js:49`      |
| OTP expiry     | 10 min                         | `server.js:64`      |
| OTP GC period  | 15 min                         | `server.js:46`      |
| Frontend target (prod) | `https://api-finance.deltainstitutions.com` | `index.html:3476` — auto-switches to `http://localhost:3210` on localhost |

## 7. Running Locally

```bash
# 1. Install deps
npm install

# 2. Start the API server (port 3210)
npm start

# 3. Open the UI
#    Open index.html directly in a browser (no bundler)
#    OR serve it via any static server, e.g.:
#    npx serve .       # then open http://localhost:3000/index.html
```

`EMAIL_SERVER` now auto-switches — localhost → `http://localhost:3210`, anything else → `https://api-finance.deltainstitutions.com`. No manual edit needed.

## 8. Deployment

See `DEPLOYMENT_GUIDE.txt`. Target is cPanel Node.js apps; the HTML is served separately (statically) and the Node app lives at `https://api.deltainstitutions.com`.

## 9. Known Limitations

- **No real DB** — JSON file is race-prone; no multi-process safety, no transactions.
- **No auth on server routes** — `/db` is readable/writable by any caller.
- **Browser-side auth only** — password hashing is done in client JS; trivially bypassable.
- **OTP store is in-memory** — server restart invalidates pending OTPs.
- **SMTP credentials in source** — must rotate; move to env vars.
- **Single 310 KB HTML file** — no modules, hard to diff, hard to test in isolation.

See `mistakes.md` for the detailed log.
