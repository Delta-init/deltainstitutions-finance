# Delta Institutions Finance — Server API

Base URL (local dev): `http://localhost:3210`
Base URL (prod, per `server.js`): `https://api.deltainstitutions.com`

All endpoints return JSON. CORS is `*`. No authentication.

---

## GET `/`

Service banner / basic liveness.

**Response 200**
```json
{
  "service": "Delta Institutions Finance Server",
  "status": "running",
  "time": "2026-04-22T07:25:49.136Z"
}
```

---

## GET `/health`

Minimal health check.

**Response 200**
```json
{ "status": "ok", "time": "2026-04-22T07:25:49.123Z" }
```

---

## POST `/send-otp`

Generate a 6-digit OTP for a given username and email the code to that user. Stored in-memory for 10 minutes keyed by lowercased username.

**Request body**
```json
{ "username": "admin", "email": "admin@example.com" }
```

**Response 200** — `{ "success": true }`
**400** — `{ "error": "username and email required" }`
**500** — `{ "error": "Failed to send OTP. Check SMTP settings." }` (SMTP failure)

Side effects:
- `otpStore.set(username.toLowerCase(), { otp, email, expires: now+600_000 })`
- Sends HTML email from `no-replay@deltainstitutions.com` with subject `<OTP> — Delta Institutions Finance password reset`

---

## POST `/verify-otp`

Verify a previously-sent OTP. On success the OTP is consumed.

**Request body**
```json
{ "username": "admin", "otp": "123456" }
```

**Response 200** — `{ "success": true }` (and OTP deleted)
**400** — one of:
- `{ "error": "username and otp required" }`
- `{ "error": "No OTP found — request a new one" }`
- `{ "error": "OTP expired — request a new one" }`
- `{ "error": "Incorrect OTP" }`

---

## POST `/send-email`

Send an arbitrary email (used for "email report"). If `html` is not provided, the server wraps `text` in a branded template.

**Request body**
```json
{
  "to": "owner@example.com",
  "subject": "Daily Finance Report — 2026-04-22",
  "text": "plain-text body",
  "html": "<p>optional html body</p>"
}
```

**Response 200** — `{ "success": true }`
**400** — `{ "error": "to and subject required" }`
**500** — `{ "error": "<nodemailer error message>" }`

---

## GET `/db`

Return the contents of `db.json`.

**Response 200** — whatever JSON object is stored
**404** — `{ "error": "No database found" }` when `db.json` is missing or unreadable

---

## PUT `/db`

Overwrite `db.json` entirely with the request body. Body **must** be a non-empty plain object (arrays rejected).

**Request body** — full DB object:
```json
{
  "users": [...],
  "accounts": [...],
  "students": [...],
  "payments": [...],
  "expenses": [...],
  "settings": { "academyName": "...", "rates": { "usdAed": 3.67, "usdInr": 83.5 } }
}
```

**Response 200** — `{ "success": true }`
**400** — `{ "error": "Invalid data" }` (null, array, or empty object)
**500** — `{ "error": "<fs error message>" }`

---

## Unknown routes

Any other path returns **404** `{ "error": "Not found" }`.

---

## Example — end-to-end OTP round-trip

```bash
# 1. Request OTP
curl -X POST http://localhost:3210/send-otp \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","email":"you@example.com"}'
# → {"success":true}   (check your inbox for the 6-digit code)

# 2. Verify it
curl -X POST http://localhost:3210/verify-otp \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","otp":"123456"}'
# → {"success":true}
```

## Example — DB round-trip

```bash
curl -X PUT http://localhost:3210/db \
  -H 'Content-Type: application/json' \
  -d '{"users":[],"accounts":[],"settings":{"academyName":"Test"}}'
# → {"success":true}

curl http://localhost:3210/db
# → {"users":[],"accounts":[],"settings":{"academyName":"Test"}}
```

## Not implemented (would be needed for a real backend)

`overview.md` enumerates the full REST surface that a database-backed version would expose (`/users`, `/accounts`, `/students`, `/programs`, `/payments`, `/expenses`, `/transfers`, `/staff`, `/payroll/run`, `/categories`, `/activity`). **None of those are currently implemented** — the server is email + JSON-blob only.
