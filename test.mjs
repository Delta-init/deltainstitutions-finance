/**
 * Delta Institutions Finance — Comprehensive Test Suite
 * 4 test cases per feature area
 */

const BASE = 'http://localhost:3210';
let passed = 0;
let failed = 0;
const results = [];

function log(section, name, ok, detail = '') {
  const icon = ok ? '✅' : '❌';
  results.push({ section, name, ok, detail });
  console.log(`  ${icon} ${name}${detail ? ' — ' + detail : ''}`);
  if (ok) passed++; else failed++;
}

async function req(method, path, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE}${path}`, opts);
  let json;
  try { json = await res.json(); } catch { json = null; }
  return { status: res.status, json };
}

// ── 1. HEALTH ────────────────────────────────────────────────
async function testHealth() {
  console.log('\n📋 HEALTH CHECKS');

  let r = await req('GET', '/');
  log('health', 'GET / returns service info', r.status === 200 && r.json?.service?.includes('DeltaInstitutions'), `status=${r.status}`);

  r = await req('GET', '/health');
  log('health', 'GET /health returns ok', r.status === 200 && r.json?.status === 'ok', `status=${r.status}`);

  r = await req('GET', '/notexist');
  log('health', 'Unknown route returns 404', r.status === 404, `status=${r.status}`);

  r = await req('GET', '/health');
  log('health', 'GET /health has timestamp', typeof r.json?.time === 'string', `time=${r.json?.time}`);
}

// ── 2. DATABASE — GET /db ────────────────────────────────────
async function testDbGet() {
  console.log('\n🗄️  DATABASE — GET /db');

  // Seed DB first so we have something to read
  const seed = {
    users: [{ id: 'u1', username: 'admin', role: 'admin', active: true }],
    accounts: [{ id: 'a1', name: 'Main Bank', type: 'bank', balance: 50000, currency: 'USD' }],
    students: [{ id: 's1', name: 'Ali Hassan', program_id: 'p1', fee: 1200, currency: 'USD' }],
    payments: [],
    expenses: [],
    settings: { academyName: 'Delta Test', rates: { usdAed: 3.67, usdInr: 83.5 } }
  };
  await req('PUT', '/db', seed);

  let r = await req('GET', '/db');
  log('db-get', 'GET /db returns 200 with data', r.status === 200, `status=${r.status}`);

  log('db-get', 'DB contains users array', Array.isArray(r.json?.users), `users count=${r.json?.users?.length}`);

  log('db-get', 'DB contains accounts array', Array.isArray(r.json?.accounts), `accounts count=${r.json?.accounts?.length}`);

  log('db-get', 'DB settings preserved correctly', r.json?.settings?.academyName === 'Delta Test', `name=${r.json?.settings?.academyName}`);
}

// ── 3. DATABASE — PUT /db ────────────────────────────────────
async function testDbPut() {
  console.log('\n🗄️  DATABASE — PUT /db');

  // Case 1: full valid payload
  const payload = {
    users: [{ id: 'u2', username: 'accountant', role: 'accountant', active: true }],
    accounts: [{ id: 'a2', name: 'PSP Account', type: 'psp', balance: 12000, currency: 'AED' }],
    students: [{ id: 's2', name: 'Sara Lee', fee: 900, currency: 'USD' }],
    payments: [{ id: 'py1', student_id: 's2', amount: 450, currency: 'USD', date: '2026-04-01' }],
    expenses: [{ id: 'ex1', category_id: 'c1', amount: 200, currency: 'USD', status: 'pending' }],
    transfers: [],
    staff: [],
    settings: { academyName: 'Delta Institutions Finance', rates: { usdAed: 3.67, usdInr: 83.5 } }
  };
  let r = await req('PUT', '/db', payload);
  log('db-put', 'PUT /db valid payload returns success', r.status === 200 && r.json?.success === true, `status=${r.status}`);

  // Case 2: verify it was actually persisted
  r = await req('GET', '/db');
  log('db-put', 'Persisted data matches sent payload', r.json?.accounts?.[0]?.name === 'PSP Account', `account=${r.json?.accounts?.[0]?.name}`);

  // Case 3: overwrite with updated balance
  payload.accounts[0].balance = 99999;
  r = await req('PUT', '/db', payload);
  const check = await req('GET', '/db');
  log('db-put', 'PUT /db overwrites with new values', check.json?.accounts?.[0]?.balance === 99999, `balance=${check.json?.accounts?.[0]?.balance}`);

  // Case 4: empty body returns 400
  r = await req('PUT', '/db', null);
  log('db-put', 'PUT /db with no body returns 400', r.status === 400, `status=${r.status}`);
}

function cleanDB() {
  return {
    users: [], accounts: [], students: [], payments: [],
    expenses: [], transfers: [], staff: [], programs: [],
    payrollRuns: [], settings: { academyName: 'Delta Institutions', rates: { usdAed: 3.67, usdInr: 83.5 } }
  };
}

// ── 4. USERS DATA ────────────────────────────────────────────
async function testUsers() {
  console.log('\n👤 USERS (via PUT /db)');
  await req('PUT', '/db', cleanDB());
  const db = (await req('GET', '/db')).json;

  // Case 1: add new user
  db.users.push({ id: 'u3', username: 'newstaff', role: 'staff', active: true, email: 'staff@test.com' });
  await req('PUT', '/db', db);
  let fresh = (await req('GET', '/db')).json;
  log('users', 'Add new user persisted to DB', fresh.users.find(u => u.username === 'newstaff') !== undefined, `count=${fresh.users.length}`);

  // Case 2: update user role
  fresh.users = fresh.users.map(u => u.id === 'u3' ? { ...u, role: 'accountant' } : u);
  await req('PUT', '/db', fresh);
  fresh = (await req('GET', '/db')).json;
  log('users', 'Update user role persisted', fresh.users.find(u => u.id === 'u3')?.role === 'accountant', `role=${fresh.users.find(u=>u.id==='u3')?.role}`);

  // Case 3: deactivate user
  fresh.users = fresh.users.map(u => u.id === 'u3' ? { ...u, active: false } : u);
  await req('PUT', '/db', fresh);
  fresh = (await req('GET', '/db')).json;
  log('users', 'Deactivate user persisted', fresh.users.find(u => u.id === 'u3')?.active === false, `active=${fresh.users.find(u=>u.id==='u3')?.active}`);

  // Case 4: delete user
  fresh.users = fresh.users.filter(u => u.id !== 'u3');
  await req('PUT', '/db', fresh);
  fresh = (await req('GET', '/db')).json;
  log('users', 'Delete user removed from DB', !fresh.users.find(u => u.id === 'u3'), `remaining users=${fresh.users.length}`);
}

// ── 5. ACCOUNTS ──────────────────────────────────────────────
async function testAccounts() {
  console.log('\n🏦 TREASURY ACCOUNTS (via PUT /db)');
  await req('PUT', '/db', cleanDB());
  let db = (await req('GET', '/db')).json;

  // Case 1: create account
  db.accounts = [{ id: 'acc1', name: 'ADCB Bank', type: 'bank', currency: 'AED', balance: 75000 }];
  await req('PUT', '/db', db);
  let fresh = (await req('GET', '/db')).json;
  log('accounts', 'Create account persisted', fresh.accounts.find(a => a.name === 'ADCB Bank') !== undefined, `count=${fresh.accounts.length}`);

  // Case 2: update balance
  fresh.accounts[0].balance = 80000;
  await req('PUT', '/db', fresh);
  fresh = (await req('GET', '/db')).json;
  log('accounts', 'Account balance update persisted', fresh.accounts[0].balance === 80000, `balance=${fresh.accounts[0].balance}`);

  // Case 3: add PSP account
  fresh.accounts.push({ id: 'acc2', name: 'Stripe PSP', type: 'psp', currency: 'USD', balance: 5000, psp_fee_pct: 2.9 });
  await req('PUT', '/db', fresh);
  fresh = (await req('GET', '/db')).json;
  log('accounts', 'Multiple accounts stored correctly', fresh.accounts.length === 2 && fresh.accounts[1].type === 'psp', `total=${fresh.accounts.length}`);

  // Case 4: delete account
  fresh.accounts = fresh.accounts.filter(a => a.id !== 'acc2');
  await req('PUT', '/db', fresh);
  fresh = (await req('GET', '/db')).json;
  log('accounts', 'Delete account removed from DB', fresh.accounts.length === 1 && !fresh.accounts.find(a => a.id === 'acc2'), `remaining=${fresh.accounts.length}`);
}

// ── 6. STUDENTS ──────────────────────────────────────────────
async function testStudents() {
  console.log('\n🎓 STUDENTS (via PUT /db)');
  await req('PUT', '/db', cleanDB());
  let db = (await req('GET', '/db')).json;
  db.students = [];

  // Case 1: enroll student
  db.students.push({ id: 'st1', name: 'Mohammed Al-Amin', program_id: 'p1', fee: 1500, currency: 'USD', email: 'm@test.com' });
  await req('PUT', '/db', db);
  let fresh = (await req('GET', '/db')).json;
  log('students', 'Enroll student persisted', fresh.students.find(s => s.name === 'Mohammed Al-Amin') !== undefined, `count=${fresh.students.length}`);

  // Case 2: update student fee
  fresh.students[0].fee = 1800;
  await req('PUT', '/db', fresh);
  fresh = (await req('GET', '/db')).json;
  log('students', 'Student fee update persisted', fresh.students[0].fee === 1800, `fee=${fresh.students[0].fee}`);

  // Case 3: add second student
  fresh.students.push({ id: 'st2', name: 'Priya Sharma', program_id: 'p1', fee: 1200, currency: 'USD' });
  await req('PUT', '/db', fresh);
  fresh = (await req('GET', '/db')).json;
  log('students', 'Multiple students stored correctly', fresh.students.length === 2, `total=${fresh.students.length}`);

  // Case 4: delete student
  fresh.students = fresh.students.filter(s => s.id !== 'st2');
  await req('PUT', '/db', fresh);
  fresh = (await req('GET', '/db')).json;
  log('students', 'Delete student removed from DB', !fresh.students.find(s => s.id === 'st2'), `remaining=${fresh.students.length}`);
}

// ── 7. PAYMENTS ──────────────────────────────────────────────
async function testPayments() {
  console.log('\n💰 PAYMENTS (via PUT /db)');
  await req('PUT', '/db', cleanDB());
  let db = (await req('GET', '/db')).json;
  db.payments = [];

  // Case 1: record payment
  db.payments.push({ id: 'py1', student_id: 'st1', account_id: 'acc1', amount: 900, currency: 'USD', date: '2026-04-01', invoice_no: 'INV-001' });
  await req('PUT', '/db', db);
  let fresh = (await req('GET', '/db')).json;
  log('payments', 'Record payment persisted', fresh.payments.find(p => p.id === 'py1') !== undefined, `count=${fresh.payments.length}`);

  // Case 2: payment with invoice number
  log('payments', 'Payment invoice_no stored correctly', fresh.payments[0].invoice_no === 'INV-001', `inv=${fresh.payments[0].invoice_no}`);

  // Case 3: add partial payment
  fresh.payments.push({ id: 'py2', student_id: 'st1', account_id: 'acc1', amount: 450, currency: 'USD', date: '2026-04-10', invoice_no: 'INV-002' });
  await req('PUT', '/db', fresh);
  fresh = (await req('GET', '/db')).json;
  log('payments', 'Multiple payments for same student stored', fresh.payments.filter(p => p.student_id === 'st1').length === 2, `count=${fresh.payments.length}`);

  // Case 4: delete payment
  fresh.payments = fresh.payments.filter(p => p.id !== 'py2');
  await req('PUT', '/db', fresh);
  fresh = (await req('GET', '/db')).json;
  log('payments', 'Delete payment removed from DB', !fresh.payments.find(p => p.id === 'py2'), `remaining=${fresh.payments.length}`);
}

// ── 8. EXPENSES ──────────────────────────────────────────────
async function testExpenses() {
  console.log('\n🧾 EXPENSES (via PUT /db)');
  await req('PUT', '/db', cleanDB());
  let db = (await req('GET', '/db')).json;
  db.expenses = [];

  // Case 1: log expense
  db.expenses.push({ id: 'ex1', category_id: 'c1', account_id: 'acc1', amount: 500, currency: 'USD', description: 'Office supplies', status: 'pending', date: '2026-04-05' });
  await req('PUT', '/db', db);
  let fresh = (await req('GET', '/db')).json;
  log('expenses', 'Log expense persisted', fresh.expenses.find(e => e.id === 'ex1') !== undefined, `count=${fresh.expenses.length}`);

  // Case 2: approve expense
  fresh.expenses[0].status = 'approved';
  await req('PUT', '/db', fresh);
  fresh = (await req('GET', '/db')).json;
  log('expenses', 'Expense approval status persisted', fresh.expenses[0].status === 'approved', `status=${fresh.expenses[0].status}`);

  // Case 3: add second expense
  fresh.expenses.push({ id: 'ex2', category_id: 'c2', account_id: 'acc1', amount: 1200, currency: 'USD', description: 'Marketing', status: 'pending', date: '2026-04-07' });
  await req('PUT', '/db', fresh);
  fresh = (await req('GET', '/db')).json;
  log('expenses', 'Multiple expenses stored correctly', fresh.expenses.length === 2, `total=${fresh.expenses.length}`);

  // Case 4: delete expense
  fresh.expenses = fresh.expenses.filter(e => e.id !== 'ex2');
  await req('PUT', '/db', fresh);
  fresh = (await req('GET', '/db')).json;
  log('expenses', 'Delete expense removed from DB', !fresh.expenses.find(e => e.id === 'ex2'), `remaining=${fresh.expenses.length}`);
}

// ── 9. TRANSFERS ─────────────────────────────────────────────
async function testTransfers() {
  console.log('\n🔄 INTERNAL TRANSFERS (via PUT /db)');
  await req('PUT', '/db', cleanDB());
  let db = (await req('GET', '/db')).json;
  db.transfers = [];

  // Case 1: record transfer
  db.transfers.push({ id: 'tr1', from_account_id: 'acc1', to_account_id: 'acc2', amount: 5000, currency: 'AED', fx_rate: 3.67, date: '2026-04-08' });
  await req('PUT', '/db', db);
  let fresh = (await req('GET', '/db')).json;
  log('transfers', 'Record transfer persisted', fresh.transfers.find(t => t.id === 'tr1') !== undefined, `count=${fresh.transfers.length}`);

  // Case 2: FX rate stored correctly
  log('transfers', 'Transfer FX rate stored correctly', fresh.transfers[0].fx_rate === 3.67, `rate=${fresh.transfers[0].fx_rate}`);

  // Case 3: add USD→INR transfer
  fresh.transfers.push({ id: 'tr2', from_account_id: 'acc1', to_account_id: 'acc3', amount: 1000, currency: 'USD', fx_rate: 83.5, date: '2026-04-09' });
  await req('PUT', '/db', fresh);
  fresh = (await req('GET', '/db')).json;
  log('transfers', 'Multi-currency transfer stored', fresh.transfers.length === 2 && fresh.transfers[1].fx_rate === 83.5, `total=${fresh.transfers.length}`);

  // Case 4: delete transfer
  fresh.transfers = fresh.transfers.filter(t => t.id !== 'tr2');
  await req('PUT', '/db', fresh);
  fresh = (await req('GET', '/db')).json;
  log('transfers', 'Delete transfer removed from DB', !fresh.transfers.find(t => t.id === 'tr2'), `remaining=${fresh.transfers.length}`);
}

// ── 10. STAFF & PAYROLL ──────────────────────────────────────
async function testStaffPayroll() {
  console.log('\n👔 STAFF & PAYROLL (via PUT /db)');
  await req('PUT', '/db', cleanDB());
  let db = (await req('GET', '/db')).json;
  db.staff = [];
  db.payrollRuns = [];

  // Case 1: add staff member
  db.staff.push({ id: 'sf1', name: 'Fatima Al-Rashid', role: 'accountant', salary: 8000, currency: 'AED', active: true });
  await req('PUT', '/db', db);
  let fresh = (await req('GET', '/db')).json;
  log('staff', 'Add staff member persisted', fresh.staff.find(s => s.name === 'Fatima Al-Rashid') !== undefined, `count=${fresh.staff.length}`);

  // Case 2: update salary
  fresh.staff[0].salary = 9000;
  await req('PUT', '/db', fresh);
  fresh = (await req('GET', '/db')).json;
  log('staff', 'Staff salary update persisted', fresh.staff[0].salary === 9000, `salary=${fresh.staff[0].salary}`);

  // Case 3: log payroll run
  fresh.payrollRuns = [{ id: 'pr1', month: '2026-03', total: 9000, currency: 'AED', run_at: '2026-04-01' }];
  await req('PUT', '/db', fresh);
  fresh = (await req('GET', '/db')).json;
  log('staff', 'Payroll run record persisted', fresh.payrollRuns.find(r => r.id === 'pr1') !== undefined, `runs=${fresh.payrollRuns.length}`);

  // Case 4: delete staff member
  fresh.staff = fresh.staff.filter(s => s.id !== 'sf1');
  await req('PUT', '/db', fresh);
  fresh = (await req('GET', '/db')).json;
  log('staff', 'Delete staff member removed from DB', !fresh.staff.find(s => s.id === 'sf1'), `remaining=${fresh.staff.length}`);
}

// ── 11. PROGRAMS ─────────────────────────────────────────────
async function testPrograms() {
  console.log('\n📚 PROGRAMS (via PUT /db)');
  await req('PUT', '/db', cleanDB());
  let db = (await req('GET', '/db')).json;
  db.programs = [];

  // Case 1: create program
  db.programs.push({ id: 'p1', name: 'Forex Foundation', fee: 1500, currency: 'USD', schedule: 'Weekdays', capacity: 20 });
  await req('PUT', '/db', db);
  let fresh = (await req('GET', '/db')).json;
  log('programs', 'Create program persisted', fresh.programs.find(p => p.name === 'Forex Foundation') !== undefined, `count=${fresh.programs.length}`);

  // Case 2: update fee
  fresh.programs[0].fee = 1800;
  await req('PUT', '/db', fresh);
  fresh = (await req('GET', '/db')).json;
  log('programs', 'Program fee update persisted', fresh.programs[0].fee === 1800, `fee=${fresh.programs[0].fee}`);

  // Case 3: add second program
  fresh.programs.push({ id: 'p2', name: 'Advanced Trading', fee: 3000, currency: 'USD', schedule: 'Weekends', capacity: 10 });
  await req('PUT', '/db', fresh);
  fresh = (await req('GET', '/db')).json;
  log('programs', 'Multiple programs stored correctly', fresh.programs.length === 2, `total=${fresh.programs.length}`);

  // Case 4: delete program
  fresh.programs = fresh.programs.filter(p => p.id !== 'p2');
  await req('PUT', '/db', fresh);
  fresh = (await req('GET', '/db')).json;
  log('programs', 'Delete program removed from DB', !fresh.programs.find(p => p.id === 'p2'), `remaining=${fresh.programs.length}`);
}

// ── 12. SETTINGS & FX RATES ──────────────────────────────────
async function testSettings() {
  console.log('\n⚙️  SETTINGS & FX RATES (via PUT /db)');
  await req('PUT', '/db', cleanDB());
  let db = (await req('GET', '/db')).json;

  // Case 1: update academy name
  db.settings.academyName = 'Delta Institutions';
  await req('PUT', '/db', db);
  let fresh = (await req('GET', '/db')).json;
  log('settings', 'Academy name update persisted', fresh.settings.academyName === 'Delta Institutions', `name=${fresh.settings.academyName}`);

  // Case 2: update USD/AED rate
  fresh.settings.rates.usdAed = 3.72;
  await req('PUT', '/db', fresh);
  fresh = (await req('GET', '/db')).json;
  log('settings', 'USD/AED rate update persisted', fresh.settings.rates.usdAed === 3.72, `rate=${fresh.settings.rates.usdAed}`);

  // Case 3: update USD/INR rate
  fresh.settings.rates.usdInr = 84.0;
  await req('PUT', '/db', fresh);
  fresh = (await req('GET', '/db')).json;
  log('settings', 'USD/INR rate update persisted', fresh.settings.rates.usdInr === 84.0, `rate=${fresh.settings.rates.usdInr}`);

  // Case 4: settings survive a full DB overwrite
  fresh.students = [];  // change something else
  await req('PUT', '/db', fresh);
  fresh = (await req('GET', '/db')).json;
  log('settings', 'Settings survive alongside other DB writes', fresh.settings.rates.usdInr === 84.0 && fresh.settings.academyName === 'Delta Institutions', `ok`);
}

// ── 13. OTP — SEND ───────────────────────────────────────────
async function testSendOtp() {
  console.log('\n📧 OTP — SEND');

  // Case 1: missing both fields
  let r = await req('POST', '/send-otp', {});
  log('otp-send', 'Missing username+email returns 400', r.status === 400, `status=${r.status}`);

  // Case 2: missing email
  r = await req('POST', '/send-otp', { username: 'admin' });
  log('otp-send', 'Missing email returns 400', r.status === 400, `status=${r.status}`);

  // Case 3: missing username
  r = await req('POST', '/send-otp', { email: 'test@test.com' });
  log('otp-send', 'Missing username returns 400', r.status === 400, `status=${r.status}`);

  // Case 4: invalid email (SMTP will reject but server should try — 500 or success)
  r = await req('POST', '/send-otp', { username: 'testuser', email: 'invalid@fakeDomain12345.xyz' });
  log('otp-send', 'Valid fields accepted (SMTP attempt made)', r.status === 200 || r.status === 500, `status=${r.status} — SMTP error expected in test env`);
}

// ── 14. OTP — VERIFY ─────────────────────────────────────────
async function testVerifyOtp() {
  console.log('\n🔐 OTP — VERIFY');

  // Case 1: missing both fields
  let r = await req('POST', '/verify-otp', {});
  log('otp-verify', 'Missing username+otp returns 400', r.status === 400, `status=${r.status}`);

  // Case 2: username with no pending OTP
  r = await req('POST', '/verify-otp', { username: 'ghost', otp: '123456' });
  log('otp-verify', 'No pending OTP returns 400', r.status === 400 && r.json?.error?.includes('No OTP'), `err=${r.json?.error}`);

  // Case 3: wrong OTP for existing user (seed one first)
  // We can't seed the OTP store directly, so we expect the "No OTP" error for a clean user
  r = await req('POST', '/verify-otp', { username: 'admin', otp: '000000' });
  log('otp-verify', 'Wrong/no OTP returns 400', r.status === 400, `status=${r.status}`);

  // Case 4: missing otp field
  r = await req('POST', '/verify-otp', { username: 'admin' });
  log('otp-verify', 'Missing otp field returns 400', r.status === 400, `status=${r.status}`);
}

// ── 15. SEND EMAIL ───────────────────────────────────────────
async function testSendEmail() {
  console.log('\n📨 SEND EMAIL REPORT');

  // Case 1: missing both to + subject
  let r = await req('POST', '/send-email', {});
  log('email', 'Missing to+subject returns 400', r.status === 400, `status=${r.status}`);

  // Case 2: missing subject
  r = await req('POST', '/send-email', { to: 'test@test.com' });
  log('email', 'Missing subject returns 400', r.status === 400, `status=${r.status}`);

  // Case 3: missing to
  r = await req('POST', '/send-email', { subject: 'Test Report' });
  log('email', 'Missing to returns 400', r.status === 400, `status=${r.status}`);

  // Case 4: valid fields (SMTP will attempt — 200 or 500 expected)
  r = await req('POST', '/send-email', { to: 'invalid@fakeDomain12345.xyz', subject: 'Daily Report', text: 'Test body' });
  log('email', 'Valid fields accepted (SMTP attempt made)', r.status === 200 || r.status === 500, `status=${r.status} — SMTP error expected in test env`);
}

// ── LARGE PAYLOAD ────────────────────────────────────────────
async function testLargePayload() {
  console.log('\n📦 LARGE PAYLOAD (10MB limit test)');

  const db = (await req('GET', '/db')).json;

  // Case 1: 500 students
  db.students = Array.from({ length: 500 }, (_, i) => ({ id: `st${i}`, name: `Student ${i}`, fee: 1000, currency: 'USD' }));
  let r = await req('PUT', '/db', db);
  log('payload', '500 students stored without error', r.status === 200, `status=${r.status}`);

  // Case 2: 500 payments
  db.payments = Array.from({ length: 500 }, (_, i) => ({ id: `py${i}`, student_id: `st${i}`, amount: 500, currency: 'USD', date: '2026-04-01' }));
  r = await req('PUT', '/db', db);
  log('payload', '500 payments stored without error', r.status === 200, `status=${r.status}`);

  // Case 3: 500 expenses
  db.expenses = Array.from({ length: 500 }, (_, i) => ({ id: `ex${i}`, amount: 100, currency: 'USD', status: 'pending', date: '2026-04-01' }));
  r = await req('PUT', '/db', db);
  log('payload', '500 expenses stored without error', r.status === 200, `status=${r.status}`);

  // Case 4: verify count after big write
  const fresh = (await req('GET', '/db')).json;
  log('payload', 'Large DB read back correctly', fresh.students.length === 500 && fresh.payments.length === 500, `students=${fresh.students.length} payments=${fresh.payments.length}`);

  // Restore clean DB
  await req('PUT', '/db', { users: [], accounts: [], students: [], payments: [], expenses: [], transfers: [], staff: [], programs: [], settings: { academyName: 'Delta Institutions', rates: { usdAed: 3.67, usdInr: 83.5 } } });
}

// ── RUN ALL ──────────────────────────────────────────────────
async function run() {
  console.log('━'.repeat(52));
  console.log('  Delta Institutions Finance — Full Test Suite');
  console.log(`  Target: ${BASE}`);
  console.log('━'.repeat(52));

  // Quick connectivity check
  try {
    await fetch(`${BASE}/health`);
  } catch {
    console.error('\n❌  Server not reachable at ' + BASE + '. Is it running?\n');
    process.exit(1);
  }

  await testHealth();
  await testDbGet();
  await testDbPut();
  await testUsers();
  await testAccounts();
  await testStudents();
  await testPayments();
  await testExpenses();
  await testTransfers();
  await testStaffPayroll();
  await testPrograms();
  await testSettings();
  await testSendOtp();
  await testVerifyOtp();
  await testSendEmail();
  await testLargePayload();

  // ── SUMMARY ──────────────────────────────────────────────
  const total = passed + failed;
  console.log('\n' + '━'.repeat(52));
  console.log(`  RESULTS: ${passed}/${total} passed`);
  if (failed > 0) {
    console.log(`\n  FAILED TESTS:`);
    results.filter(r => !r.ok).forEach(r => console.log(`    ❌ [${r.section}] ${r.name} — ${r.detail}`));
  }
  console.log('━'.repeat(52) + '\n');
  process.exit(failed > 0 ? 1 : 0);
}

run();
