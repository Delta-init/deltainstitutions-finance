# Delta Institutions Finance Manager — Full Project Overview

## Architecture Summary

| Layer | Technology | Status |
|-------|-----------|--------|
| Frontend | Single-page HTML + Vanilla JS | ✅ Complete |
| Email Server | Node.js + Express + Nodemailer | ✅ Running on port 3210 |
| Database | **None — LocalStorage only** | ❌ Data lost on cache clear |

---

## Pages & What Each Does

| Page | Key Actions |
|------|-------------|
| **Dashboard** | Shows totals: revenue, expenses, profit, payroll. No data mutations. |
| **Treasury Accounts** | Add/edit/delete Bank, PSP, Cash, Exchanger accounts with balances and currencies |
| **Internal Transfers** | Record money moved between accounts with FX conversion rates |
| **FX Rates** | Update USD→AED and USD→INR exchange rates (used globally for conversion) |
| **Students** | Enroll students into programs, set fee amounts and currencies |
| **Programs** | Create training programs with fees, schedule, capacity |
| **Payments** | Record student fee payments, upload proof files, generate invoices/receipts |
| **Expenses** | Log expenses by category, upload proof, approve/reject workflow |
| **Payroll** | Manage staff salaries, run payroll, track payroll history |
| **Reminders** | View overdue/upcoming student payment reminders, copy reminder text |
| **Reports** | Filter and export financial data as CSV, PDF, or email |
| **Users** | Admin-only: create users, assign roles, activate/deactivate, reset passwords |

---

## All HTML Actions

### Authentication
| Function | Triggered By | What It Does |
|----------|-------------|--------------|
| `doLogin()` | Login form submit | Validates username + password hash against LocalStorage users |
| `doSendOtp()` | Forgot password form | POSTs `{username, email}` → `/send-otp` |
| `doVerifyOtp()` | OTP verify form | POSTs `{username, otp}` → `/verify-otp`, then allows password reset |
| `doLogout()` | Logout button | Clears session, redirects to login |

### Users
| Function | What It Does |
|----------|-------------|
| `saveUser('')` | Creates new user in LocalStorage |
| `saveUser(id)` | Updates existing user in LocalStorage |
| `confirmDelete('user', id)` | Deletes user from LocalStorage |
| `toggleUserActive(id)` | Flips active/inactive flag on user |
| `changePassword(id)` | Updates hashed password in LocalStorage |

### Programs
| Function | What It Does |
|----------|-------------|
| `saveProgram('')` | Creates program with name, fee, currency, schedule, capacity |
| `saveProgram(id)` | Updates program |
| `confirmDelete('program', id)` | Deletes program |

### Treasury Accounts
| Function | What It Does |
|----------|-------------|
| `saveAccount('')` | Creates account (Bank/PSP/Cash/Exchanger) with balance |
| `saveAccount(id)` | Updates account |
| `confirmDelete('account', id)` | Deletes account |

### Students
| Function | What It Does |
|----------|-------------|
| `saveStudent('')` | Enrolls new student with program and fee |
| `saveStudent(id)` | Updates student record |
| `confirmDelete('student', id)` | Deletes student |

### Payments
| Function | What It Does |
|----------|-------------|
| `savePayment()` | Records payment, credits account balance, uploads proof (base64 in LocalStorage) |
| `confirmDelete('payment', id)` | Deletes payment, reverses account balance |
| `generateInvoice(id)` | Opens printable invoice for a payment |
| `viewProof(id)` | Shows uploaded payment proof image |

### Expenses
| Function | What It Does |
|----------|-------------|
| `saveExpense()` | Logs expense, debits account balance, uploads proof |
| `confirmDelete('expense', id)` | Deletes expense, reverses account balance |
| `approveExpense(id)` | Sets expense status to "approved" |
| `viewExpenseProof(id)` | Shows uploaded expense proof image |

### Staff & Payroll
| Function | What It Does |
|----------|-------------|
| `saveStaff('')` | Creates staff member with salary and currency |
| `saveStaff(id)` | Updates staff member |
| `confirmDelete('staff', id)` | Deletes staff member |
| `runPayroll()` | Executes payroll run, debits accounts, logs payroll record |

### Transfers
| Function | What It Does |
|----------|-------------|
| `saveTransfer()` | Records transfer between two accounts with FX rate applied |
| `confirmDelete('transfer', id)` | Deletes transfer, reverses both account balances |

### Expense Categories
| Function | What It Does |
|----------|-------------|
| `addCategory()` | Creates expense category with color |
| `addSubcategory(id)` | Adds subcategory under a category |
| `renameCatPrompt(id)` | Renames category |
| `renameSubPrompt(id)` | Renames subcategory |
| `deleteCat(id)` | Deletes category |
| `deleteSub(id)` | Deletes subcategory |

### Reports & Export
| Function | What It Does |
|----------|-------------|
| `exportFilteredCSV()` | Downloads filtered report as CSV |
| `exportStatementCSV()` | Downloads account statement as CSV |
| `exportStatementPDF()` | Opens print dialog for PDF statement |
| `sendEmailReport()` | POSTs `{to, subject, text, html}` → `/send-email` |
| `copyReportText()` | Copies report text to clipboard |

### Settings
| Function | What It Does |
|----------|-------------|
| `saveFX()` | Saves USD/AED and USD/INR exchange rates |
| `setCur(currency)` | Switches display currency (AED/USD/INR) |

---

## Current Server Routes (server.js)

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/` | Health check |
| GET | `/health` | Health check |
| POST | `/send-otp` | Generate and email a 6-digit OTP for password reset |
| POST | `/verify-otp` | Validate OTP code |
| POST | `/send-email` | Send finance report email |

**The server does nothing with data — it only sends emails.**

---

## What Needs to Change to Connect a Database

### Recommended Database
- **SQLite** (simplest — single file, no setup, good for single-server deployment)
- Or **MySQL/PostgreSQL** if already available on cPanel

### New npm packages needed
```
better-sqlite3    # for SQLite (sync, fast, simple)
# OR
mysql2            # for MySQL
# OR
pg                # for PostgreSQL
```

---

## Required New API Routes in server.js

Every LocalStorage `save/delete/update` action needs a matching REST endpoint. Below is the complete list:

### Settings
| Method | Route | Body | Purpose |
|--------|-------|------|---------|
| GET | `/settings` | — | Load settings (academy name, FX rates) |
| PUT | `/settings` | `{key, value}` | Save setting |

### Users
| Method | Route | Body | Purpose |
|--------|-------|------|---------|
| GET | `/users` | — | List all users |
| POST | `/users` | `{username, email, role, password_hash, staff_id}` | Create user |
| PUT | `/users/:id` | `{field: value, ...}` | Update user (name, role, active, password) |
| DELETE | `/users/:id` | — | Delete user |

### Programs
| Method | Route | Body | Purpose |
|--------|-------|------|---------|
| GET | `/programs` | — | List all programs |
| POST | `/programs` | `{name, fee, currency, schedule, capacity}` | Create program |
| PUT | `/programs/:id` | `{...fields}` | Update program |
| DELETE | `/programs/:id` | — | Delete program |

### Treasury Accounts
| Method | Route | Body | Purpose |
|--------|-------|------|---------|
| GET | `/accounts` | — | List all accounts |
| POST | `/accounts` | `{name, type, currency, balance, psp_fee_pct}` | Create account |
| PUT | `/accounts/:id` | `{...fields}` | Update account (including balance changes) |
| DELETE | `/accounts/:id` | — | Delete account |

### Students
| Method | Route | Body | Purpose |
|--------|-------|------|---------|
| GET | `/students` | — | List all students |
| POST | `/students` | `{name, email, phone, program_id, fee, currency}` | Create student |
| PUT | `/students/:id` | `{...fields}` | Update student |
| DELETE | `/students/:id` | — | Delete student |

### Payments
| Method | Route | Body | Purpose |
|--------|-------|------|---------|
| GET | `/payments` | — | List all payments |
| POST | `/payments` | `{student_id, account_id, amount, currency, proof_base64, date}` | Record payment + update account balance |
| DELETE | `/payments/:id` | — | Delete payment + reverse account balance |

### Expenses
| Method | Route | Body | Purpose |
|--------|-------|------|---------|
| GET | `/expenses` | — | List all expenses |
| POST | `/expenses` | `{category_id, account_id, amount, currency, proof_base64, date, status}` | Log expense + debit account |
| PUT | `/expenses/:id/approve` | — | Set status to "approved" |
| DELETE | `/expenses/:id` | — | Delete expense + reverse account balance |

### Staff
| Method | Route | Body | Purpose |
|--------|-------|------|---------|
| GET | `/staff` | — | List all staff |
| POST | `/staff` | `{name, role, salary, currency, account_id}` | Create staff |
| PUT | `/staff/:id` | `{...fields}` | Update staff |
| DELETE | `/staff/:id` | — | Delete staff |

### Payroll
| Method | Route | Body | Purpose |
|--------|-------|------|---------|
| GET | `/payroll` | — | List payroll run history |
| POST | `/payroll/run` | `{month, staff_ids, account_id}` | Execute payroll, debit account, log run |

### Transfers
| Method | Route | Body | Purpose |
|--------|-------|------|---------|
| GET | `/transfers` | — | List all transfers |
| POST | `/transfers` | `{from_account_id, to_account_id, amount, fx_rate, date}` | Record transfer + update both balances |
| DELETE | `/transfers/:id` | — | Delete transfer + reverse both balances |

### Expense Categories
| Method | Route | Body | Purpose |
|--------|-------|------|---------|
| GET | `/categories` | — | List categories with subcategories |
| POST | `/categories` | `{name, color}` | Create category |
| PUT | `/categories/:id` | `{name}` | Rename category |
| DELETE | `/categories/:id` | — | Delete category |
| POST | `/categories/:id/subs` | `{name}` | Add subcategory |
| PUT | `/categories/:id/subs/:sub_id` | `{name}` | Rename subcategory |
| DELETE | `/categories/:id/subs/:sub_id` | — | Delete subcategory |

### Activity Log
| Method | Route | Body | Purpose |
|--------|-------|------|---------|
| GET | `/activity` | — | Get last 200 activity entries |
| POST | `/activity` | `{user, action, details}` | Log an activity |

---

## Database Schema (SQLite example)

```sql
CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT);

CREATE TABLE users (
  id TEXT PRIMARY KEY, username TEXT UNIQUE, email TEXT,
  role TEXT, password_hash TEXT, staff_id TEXT,
  active INTEGER DEFAULT 1, created_at TEXT
);

CREATE TABLE programs (
  id TEXT PRIMARY KEY, name TEXT, fee REAL, currency TEXT,
  schedule TEXT, capacity INTEGER, enrolled INTEGER DEFAULT 0
);

CREATE TABLE accounts (
  id TEXT PRIMARY KEY, name TEXT, type TEXT, currency TEXT,
  balance REAL DEFAULT 0, psp_fee_pct REAL DEFAULT 0
);

CREATE TABLE students (
  id TEXT PRIMARY KEY, name TEXT, email TEXT, phone TEXT,
  program_id TEXT, fee REAL, currency TEXT, enrolled_at TEXT
);

CREATE TABLE payments (
  id TEXT PRIMARY KEY, student_id TEXT, account_id TEXT,
  amount REAL, currency TEXT, proof TEXT, date TEXT,
  invoice_no TEXT, created_at TEXT
);

CREATE TABLE expenses (
  id TEXT PRIMARY KEY, category_id TEXT, sub_id TEXT,
  account_id TEXT, amount REAL, currency TEXT,
  description TEXT, proof TEXT, date TEXT,
  status TEXT DEFAULT 'pending', created_at TEXT
);

CREATE TABLE staff (
  id TEXT PRIMARY KEY, name TEXT, role TEXT,
  salary REAL, currency TEXT, account_id TEXT, active INTEGER DEFAULT 1
);

CREATE TABLE payroll_runs (
  id TEXT PRIMARY KEY, month TEXT, total REAL,
  currency TEXT, account_id TEXT, run_at TEXT
);

CREATE TABLE transfers (
  id TEXT PRIMARY KEY, from_account_id TEXT, to_account_id TEXT,
  amount REAL, fx_rate REAL, converted_amount REAL, date TEXT
);

CREATE TABLE categories (
  id TEXT PRIMARY KEY, name TEXT, color TEXT
);

CREATE TABLE subcategories (
  id TEXT PRIMARY KEY, category_id TEXT, name TEXT
);

CREATE TABLE activity_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user TEXT, action TEXT, details TEXT, created_at TEXT
);
```

---

## Changes Required in index.html

Once the server has database routes, every LocalStorage read/write in the HTML must be replaced with `fetch()` calls:

| Current (LocalStorage) | Replace With |
|------------------------|-------------|
| `localStorage.getItem('users')` | `GET /users` |
| `localStorage.setItem('users', ...)` | `POST /users` or `PUT /users/:id` |
| `localStorage.removeItem(...)` | `DELETE /:resource/:id` |

Every `save*()` and `confirmDelete()` function needs to be updated — roughly 30–40 functions.

---

## Security Issues to Fix

| Issue | Fix |
|-------|-----|
| SMTP password hardcoded in server.js | Move to `.env` file using `dotenv` |
| CORS allows all origins (`*`) | Restrict to `https://finance.deltainstitutions.com` |
| Simple password hash (`simpleHash`) in HTML | Use `bcrypt` on server, never client-side |
| No rate limiting on `/send-otp` | Add `express-rate-limit` |
| File proofs stored as base64 in LocalStorage | Store as actual files on server (`/uploads`) |

---

## Migration Path (Step by Step)

1. **Add database** — Install `better-sqlite3`, create DB file, run schema
2. **Add all REST routes** to server.js (see table above)
3. **Add auth middleware** — Simple JWT or session token so only logged-in users can call the API
4. **Update index.html** — Replace every LocalStorage call with a `fetch()` to the new endpoints
5. **Migrate existing data** — Export current LocalStorage data and import into DB
6. **Move secrets to .env** — `SMTP_PASS`, `DB_PATH`, `JWT_SECRET`
