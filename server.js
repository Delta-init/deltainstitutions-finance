/**
 * Delta Institutions — Finance Manager
 * Email + Data server — cPanel / Production build
 *
 * HOSTED AT: https://finance.deltainstitutions.com
 */

import "dotenv/config";
import express from "express";
import cors from "cors";
import nodemailer from "nodemailer";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import mongoose from "mongoose";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3210;

// ── MONGODB ───────────────────────────────────────────────────
const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/delta-finance";

mongoose
  .connect(MONGODB_URI, {
    authSource: "admin",
  })
  .then(() => {
    console.log(
      "✅  MongoDB connected:",
      MONGODB_URI.replace(/:\/\/.*@/, "://***@"),
    );
    seedFromFile();
  })
  .catch((e) => console.error("❌  MongoDB connection error:", e.message));

// ── MONGOOSE SCHEMAS ──────────────────────────────────────────
const raw = { strict: false };

const SettingsModel = mongoose.model(
  "Settings",
  new mongoose.Schema({ _id: String }, raw),
);
const UserModel = mongoose.model(
  "User",
  new mongoose.Schema({ id: String }, raw),
);
const AccountModel = mongoose.model(
  "Account",
  new mongoose.Schema({ id: String }, raw),
);
const StudentModel = mongoose.model(
  "Student",
  new mongoose.Schema({ id: String }, raw),
);
const ProgramModel = mongoose.model(
  "Program",
  new mongoose.Schema({ id: String }, raw),
);
const PaymentModel = mongoose.model(
  "Payment",
  new mongoose.Schema({ id: String }, raw),
);
const ExpenseModel = mongoose.model(
  "Expense",
  new mongoose.Schema({ id: String }, raw),
);
const StaffModel = mongoose.model(
  "Staff",
  new mongoose.Schema({ id: String }, raw),
);
const TransferModel = mongoose.model(
  "Transfer",
  new mongoose.Schema({ id: String }, raw),
);
const PayrollModel = mongoose.model(
  "PayrollRun",
  new mongoose.Schema({ id: String }, raw),
);
const CategoryModel = mongoose.model(
  "Category",
  new mongoose.Schema({ id: String }, raw),
);

// helper — strip Mongoose internals for clean JSON output
function clean(docs) {
  return docs.map((d) => {
    const o = d.toObject();
    delete o._id;
    delete o.__v;
    return o;
  });
}

// ── READ DB — assemble from all collections ───────────────────
async function readDB() {
  const [
    settingsDoc,
    users,
    accounts,
    students,
    programs,
    payments,
    expenses,
    staff,
    transfers,
    payrollRuns,
    categories,
  ] = await Promise.all([
    SettingsModel.findById("main").lean(),
    UserModel.find().lean(),
    AccountModel.find().lean(),
    StudentModel.find().lean(),
    ProgramModel.find().lean(),
    PaymentModel.find().lean(),
    ExpenseModel.find().lean(),
    StaffModel.find().lean(),
    TransferModel.find().lean(),
    PayrollModel.find().lean(),
    CategoryModel.find().lean(),
  ]);

  const strip = (docs) => docs.map(({ _id, __v, ...rest }) => rest);

  const settings = settingsDoc
    ? (({ _id, __v, ...rest }) => rest)(settingsDoc)
    : { academyName: "Delta Institutions", rates: { usdAed: 3.67, usdInr: 83.5 } };

  return {
    settings,
    users: strip(users),
    accounts: strip(accounts),
    students: strip(students),
    programs: strip(programs),
    payments: strip(payments),
    expenses: strip(expenses),
    staff: strip(staff),
    transfers: strip(transfers),
    payrollRuns: strip(payrollRuns),
    expenseCategories: strip(categories),
  };
}

// ── WRITE DB — distribute into collections ────────────────────
async function writeDB(data) {
  const ops = [];

  // settings — single document with fixed _id
  if (data.settings) {
    ops.push(
      SettingsModel.findByIdAndUpdate(
        "main",
        { ...data.settings, _id: "main" },
        { upsert: true, new: true },
      ),
    );
  }

  // array collections — replace all docs with what the client sent
  const pairs = [
    [UserModel, data.users],
    [AccountModel, data.accounts],
    [StudentModel, data.students],
    [ProgramModel, data.programs],
    [PaymentModel, data.payments],
    [ExpenseModel, data.expenses],
    [StaffModel, data.staff],
    [TransferModel, data.transfers],
    [PayrollModel, data.payrollRuns],
    [CategoryModel, data.expenseCategories],
  ];

  for (const [Model, arr] of pairs) {
    if (!Array.isArray(arr)) continue;
    ops.push(
      Model.deleteMany({}).then(() =>
        arr.length > 0
          ? Model.insertMany(arr, { ordered: false })
          : Promise.resolve(),
      ),
    );
  }

  await Promise.all(ops);
}

// ── SEED FROM db.json (one-time migration) ────────────────────
async function seedFromFile() {
  const dbFile = path.join(__dirname, "db.json");
  if (!fs.existsSync(dbFile)) return;
  try {
    const count = await UserModel.countDocuments();
    if (count > 0) return; // already seeded
    const data = JSON.parse(fs.readFileSync(dbFile, "utf8"));
    await writeDB(data);
    console.log("✅  Seeded MongoDB from db.json");
  } catch (e) {
    console.error("Seed error:", e.message);
  }
}

// ── SMTP ─────────────────────────────────────────────────────
const SMTP_FILE = path.join(__dirname, "smtp.json");

const DEFAULT_SMTP = {
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  user: "no-reply@deltainstitutions.com",
  pass: "ghcanbkkqvaiyfpz",
};

function loadSmtpConfig() {
  try {
    if (fs.existsSync(SMTP_FILE))
      return {
        ...DEFAULT_SMTP,
        ...JSON.parse(fs.readFileSync(SMTP_FILE, "utf8")),
      };
  } catch (e) {
    console.error("SMTP config read error:", e.message);
  }
  return { ...DEFAULT_SMTP };
}

function saveSmtpConfig(cfg) {
  fs.writeFileSync(SMTP_FILE, JSON.stringify(cfg), "utf8");
}

let _smtpCfg = loadSmtpConfig();
let _smtpOk = false;
let transporter;

function buildTransporter(cfg) {
  transporter = nodemailer.createTransport({
    host: cfg.host,
    port: Number(cfg.port),
    secure: !!cfg.secure,
    requireTLS: !cfg.secure,
    auth: { user: cfg.user, pass: cfg.pass },
    tls: { rejectUnauthorized: false },
  });
  _smtpOk = false;
  transporter.verify((error) => {
    if (error) {
      console.error("⚠️  SMTP error:", error.message);
      _smtpOk = false;
    } else {
      console.log("✅  SMTP connected:", cfg.host);
      _smtpOk = true;
    }
  });
}

buildTransporter(_smtpCfg);

// ── MIDDLEWARE ───────────────────────────────────────────────
app.use(cors({ origin: "*" }));
app.use(express.json({ limit: "10mb" }));
app.set("trust proxy", 1);
app.use((req, _res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

// ── HEALTH ───────────────────────────────────────────────────
app.get("/", (_req, res) =>
  res.json({
    service: "Delta Institutions Finance Server",
    status: "running",
    db: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
    time: new Date().toISOString(),
  }),
);

app.get("/health", (_req, res) =>
  res.json({
    status: "ok",
    db: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
    time: new Date().toISOString(),
  }),
);

// ── SMTP STATUS ──────────────────────────────────────────────
app.get("/smtp-status", (_req, res) => {
  res.json({
    connected: _smtpOk,
    host: _smtpCfg.host,
    port: _smtpCfg.port,
    user: _smtpCfg.user,
  });
});

// ── SMTP CONFIG ──────────────────────────────────────────────
app.get("/smtp-config", (_req, res) => {
  res.json({
    host: _smtpCfg.host,
    port: _smtpCfg.port,
    secure: _smtpCfg.secure,
    user: _smtpCfg.user,
  });
});

app.post("/smtp-config", async (req, res) => {
  const { host, port, secure, user, pass } = req.body || {};
  if (!host || !port || !user || !pass)
    return res
      .status(400)
      .json({ error: "host, port, user and pass are required" });

  const newCfg = {
    host: host.trim(),
    port: Number(port),
    secure: !!secure,
    user: user.trim(),
    pass,
  };
  try {
    const test = nodemailer.createTransport({
      host: newCfg.host,
      port: newCfg.port,
      secure: newCfg.secure,
      requireTLS: !newCfg.secure,
      auth: { user: newCfg.user, pass: newCfg.pass },
      tls: { rejectUnauthorized: false },
    });
    await test.verify();
    saveSmtpConfig(newCfg);
    _smtpCfg = newCfg;
    buildTransporter(_smtpCfg);
    console.log("SMTP config updated:", newCfg.host);
    res.json({ success: true, message: "SMTP verified and updated" });
  } catch (e) {
    res.status(400).json({ error: `SMTP test failed: ${e.message}` });
  }
});

// ── SEND OTP ─────────────────────────────────────────────────
const otpStore = new Map();
setInterval(
  () => {
    const now = Date.now();
    for (const [k, v] of otpStore.entries())
      if (now > v.expires) otpStore.delete(k);
  },
  15 * 60 * 1000,
);

app.post("/send-otp", async (req, res) => {
  const { username, email } = req.body || {};
  if (!username || !email)
    return res.status(400).json({ error: "username and email required" });

  const otp = crypto.randomInt(100000, 999999).toString();
  otpStore.set(username.toLowerCase(), {
    otp,
    email,
    expires: Date.now() + 10 * 60 * 1000,
  });

  const html = `
<div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto">
  <div style="background:#0f0f0f;padding:20px 28px;border-radius:10px 10px 0 0">
    <span style="font-size:20px;font-weight:700;color:#fff">
      <span style="color:#d42a2a">d</span><span style="color:#7b2cbf">e</span><span style="color:#1e3fcf">l</span><span style="color:#1e7d3b">t</span><span style="color:#f5a623">a</span>
      <span style="color:#fff;font-size:14px;letter-spacing:2px"> INSTITUTIONS</span>
    </span>
    <span style="font-size:11px;color:#888;font-family:monospace;margin-left:8px">Finance Manager</span>
  </div>
  <div style="background:#fff;border:1px solid #eee;padding:28px;border-radius:0 0 10px 10px">
    <h2 style="margin:0 0 12px;color:#111;font-size:18px">Password Reset OTP</h2>
    <p style="color:#666;font-size:14px;margin:0 0 20px">Reset request for user <strong>${username}</strong>.</p>
    <div style="background:#f8f8f8;border:2px solid #1e3fcf;border-radius:10px;padding:22px;text-align:center;margin:0 0 20px">
      <div style="font-size:11px;color:#999;letter-spacing:3px;text-transform:uppercase;margin-bottom:8px">One-Time Password</div>
      <div style="font-size:42px;font-weight:700;letter-spacing:10px;color:#1e3fcf;font-family:monospace">${otp}</div>
      <div style="font-size:12px;color:#aaa;margin-top:8px">Expires in 10 minutes</div>
    </div>
    <p style="color:#aaa;font-size:12px;margin:0">If you didn't request this, ignore this email.</p>
  </div>
</div>`;

  try {
    await transporter.sendMail({
      from: '"Delta Institutions" <no-reply@deltainstitutions.com>',
      to: email,
      subject: `${otp} — Delta Institutions Finance password reset`,
      html,
      text: `Your OTP is: ${otp}\nExpires in 10 minutes.`,
    });
    console.log(`OTP sent → ${email} (user: ${username})`);
    res.json({ success: true });
  } catch (err) {
    console.error("OTP error:", err.message);
    res.status(500).json({ error: "Failed to send OTP. Check SMTP settings." });
  }
});

// ── VERIFY OTP ───────────────────────────────────────────────
app.post("/verify-otp", (req, res) => {
  const { username, otp } = req.body || {};
  if (!username || !otp)
    return res.status(400).json({ error: "username and otp required" });

  const record = otpStore.get(username.toLowerCase());
  if (!record)
    return res.status(400).json({ error: "No OTP found — request a new one" });
  if (Date.now() > record.expires) {
    otpStore.delete(username.toLowerCase());
    return res.status(400).json({ error: "OTP expired — request a new one" });
  }
  if (record.otp !== otp.toString().trim())
    return res.status(400).json({ error: "Incorrect OTP" });

  otpStore.delete(username.toLowerCase());
  console.log(`OTP verified for: ${username}`);
  res.json({ success: true });
});

// ── SEND REPORT EMAIL ────────────────────────────────────────
app.post("/send-email", async (req, res) => {
  const { to, subject, text, html } = req.body || {};
  if (!to || !subject)
    return res.status(400).json({ error: "to and subject required" });

  const emailHtml =
    html ||
    `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
  <div style="background:#0f0f0f;padding:18px 28px;border-radius:10px 10px 0 0">
    <span style="font-size:18px;font-weight:700;color:#fff">
      <span style="color:#d42a2a">d</span><span style="color:#7b2cbf">e</span><span style="color:#1e3fcf">l</span><span style="color:#1e7d3b">t</span><span style="color:#f5a623">a</span>
      <span style="color:#fff;font-size:13px;letter-spacing:2px"> INSTITUTIONS</span>
    </span>
    <span style="font-size:11px;color:#888;font-family:monospace;margin-left:8px">Daily Finance Report</span>
  </div>
  <div style="background:#fff;border:1px solid #eee;padding:24px 28px;border-radius:0 0 10px 10px">
    <pre style="font-family:monospace;font-size:13px;color:#333;white-space:pre-wrap;line-height:1.7;margin:0">${text || ""}</pre>
  </div>
  <div style="text-align:center;padding:12px;font-size:11px;color:#aaa">Delta Institutions · no-reply@deltainstitutions.com</div>
</div>`;

  try {
    await transporter.sendMail({
      from: '"Delta Institutions" <no-reply@deltainstitutions.com>',
      to,
      subject,
      text: text || "",
      html: emailHtml,
    });
    console.log(`Report sent → ${to}`);
    res.json({ success: true });
  } catch (err) {
    console.error("Report email error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── DATABASE ROUTES ───────────────────────────────────────────
app.get("/db", async (_req, res) => {
  try {
    const data = await readDB();
    res.json(data);
  } catch (e) {
    console.error("DB read error:", e.message);
    res.status(500).json({ error: e.message });
  }
});

app.put("/db", async (req, res) => {
  const data = req.body;
  if (
    !data ||
    typeof data !== "object" ||
    Array.isArray(data) ||
    Object.keys(data).length === 0
  )
    return res.status(400).json({ error: "Invalid data" });
  try {
    await writeDB(data);
    res.json({ success: true });
  } catch (e) {
    console.error("DB write error:", e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── 404 ───────────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ error: "Not found" }));

// ── START ─────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n${"━".repeat(46)}`);
  console.log(`  Delta Institutions Finance Server`);
  console.log(`  Port    : ${PORT}`);
  console.log(`  Local   : http://localhost:${PORT}`);
  console.log(`  Live    : https://finance.deltainstitutions.com`);
  console.log(`  MongoDB : ${MONGODB_URI.replace(/:\/\/.*@/, "://***@")}`);
  console.log(`  SMTP    : ${_smtpCfg.host}:${_smtpCfg.port}`);
  console.log(`${"━".repeat(46)}\n`);
});
