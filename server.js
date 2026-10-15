const express = require("express");
const session = require("express-session");
const SQLiteStore = require("connect-sqlite3")(session);
const Database = require("better-sqlite3");
const bcrypt = require("bcryptjs");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const path = require("path");

const app = express();
const PORT = Number(process.env.PORT || 3000);
const production = process.env.NODE_ENV === "production";
const sessionSecret = process.env.SESSION_SECRET;

if (!sessionSecret || sessionSecret.length < 32) {
  if (production) {
    console.error("SESSION_SECRET must be set to a random string of at least 32 characters.");
    process.exit(1);
  }
  console.warn("WARNING: Set SESSION_SECRET to a long random value before deployment.");
}
if (production && (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD)) {
  console.error("Set ADMIN_EMAIL and ADMIN_PASSWORD in the hosting environment.");
  process.exit(1);
}

const db = new Database(path.join(__dirname, "cinema.sqlite"));
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  username TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('user','admin')),
  avatar TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  disabled INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS favorites (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  episode_id INTEGER NOT NULL,
  PRIMARY KEY(user_id, episode_id)
);
CREATE TABLE IF NOT EXISTS watched (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  episode_id INTEGER NOT NULL,
  watched_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY(user_id, episode_id)
);
`);

function ensureBootstrapAdmin() {
  const email = String(process.env.ADMIN_EMAIL || "").trim().toLowerCase();
  const password = String(process.env.ADMIN_PASSWORD || "");
  if (!email || !password) {
    console.warn("No bootstrap admin configured. Set ADMIN_EMAIL and ADMIN_PASSWORD privately.");
    return;
  }
  if (password.length < 12) {
    console.error("ADMIN_PASSWORD must be at least 12 characters. Admin bootstrap skipped.");
    return;
  }
  const existing = db.prepare("SELECT id, role FROM users WHERE email = ?").get(email);
  if (!existing) {
    const hash = bcrypt.hashSync(password, 12);
    db.prepare("INSERT INTO users (email, username, password_hash, role) VALUES (?, ?, ?, 'admin')")
      .run(email, "Administrator", hash);
    console.log("Initial admin account created from environment configuration.");
  } else if (existing.role !== "admin") {
    console.warn("ADMIN_EMAIL already belongs to a non-admin account. No automatic privilege escalation performed.");
  }
}
ensureBootstrapAdmin();

app.disable("x-powered-by");
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "https://cdnjs.cloudflare.com", "https://cdn.tailwindcss.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com", "data:"],
      imgSrc: ["'self'", "data:", "https://images.unsplash.com", "https://*.unsplash.com"],
      connectSrc: ["'self'"],
      mediaSrc: ["'self'", "https:", "blob:"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"]
    }
  },
  crossOriginEmbedderPolicy: false
}));
app.use(express.json({ limit: "20kb" }));
app.use(express.urlencoded({ extended: false, limit: "20kb" }));

app.use(session({
  name: "cinema.sid",
  secret: sessionSecret || "development-only-change-this-secret-000000",
  resave: false,
  saveUninitialized: false,
  store: new SQLiteStore({ db: "sessions.sqlite", dir: __dirname }),
  cookie: {
    httpOnly: true,
    sameSite: "lax",
    secure: production,
    maxAge: 1000 * 60 * 60 * 24 * 7
  }
}));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 12,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "محاولات كثيرة. حاول مرة ثانية بعد قليل." }
});
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: "draft-7",
  legacyHeaders: false
});

app.use("/api", apiLimiter);
app.use(express.static(path.join(__dirname, "public")));

function cleanUser(row) {
  return {
    id: row.id,
    email: row.email,
    username: row.username,
    role: row.role,
    avatar: row.avatar || "",
    createdAt: row.created_at
  };
}
function requireAuth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: "سجّل الدخول أولاً." });
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.session.userId);
  if (!user || user.disabled) {
    req.session.destroy(() => {});
    return res.status(401).json({ error: "الحساب غير متاح. سجّل الدخول مجدداً." });
  }
  req.user = user;
  next();
}
function requireAdmin(req, res, next) {
  if (req.user.role !== "admin") return res.status(403).json({ error: "هذه الصفحة مخصصة للإدارة." });
  next();
}
function validEmail(email) {
  return typeof email === "string" && email.length <= 254 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
function safeUsername(value) {
  return typeof value === "string" && value.trim().length >= 2 &&
    value.trim().length <= 30 && /^[\p{L}\p{N}_ .-]+$/u.test(value.trim());
}

app.get("/api/me", (req, res) => {
  if (!req.session.userId) return res.json({ user: null });
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.session.userId);
  if (!user || user.disabled) {
    req.session.destroy(() => {});
    return res.json({ user: null });
  }
  const favorites = db.prepare("SELECT episode_id FROM favorites WHERE user_id = ?").all(user.id).map(x => x.episode_id);
  const watched = db.prepare("SELECT episode_id FROM watched WHERE user_id = ?").all(user.id).map(x => x.episode_id);
  res.json({ user: cleanUser(user), favorites, watched });
});

app.post("/api/register", authLimiter, (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  const username = String(req.body.username || "").trim();
  const password = String(req.body.password || "");
  if (!validEmail(email)) return res.status(400).json({ error: "اكتب بريدًا إلكترونيًا صحيحًا." });
  if (!safeUsername(username)) return res.status(400).json({ error: "اسم المستخدم يجب أن يكون من حرفين إلى 30 حرفًا." });
  if (password.length < 10 || password.length > 128) {
    return res.status(400).json({ error: "كلمة المرور يجب أن تكون بين 10 و128 حرفًا." });
  }
  if (db.prepare("SELECT id FROM users WHERE email = ?").get(email)) {
    return res.status(409).json({ error: "هذا البريد مسجل مسبقًا." });
  }
  const hash = bcrypt.hashSync(password, 12);
  try {
    const result = db.prepare("INSERT INTO users (email, username, password_hash) VALUES (?, ?, ?)").run(email, username, hash);
    req.session.regenerate(err => {
      if (err) return res.status(500).json({ error: "تعذر إنشاء الجلسة." });
      req.session.userId = Number(result.lastInsertRowid);
      req.session.save(saveErr => {
        if (saveErr) return res.status(500).json({ error: "تعذر حفظ الجلسة." });
        const user = db.prepare("SELECT * FROM users WHERE id = ?").get(result.lastInsertRowid);
        res.status(201).json({ user: cleanUser(user), favorites: [], watched: [] });
      });
    });
  } catch (e) {
    res.status(500).json({ error: "تعذر إنشاء الحساب." });
  }
});

app.post("/api/login", authLimiter, (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");
  const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
  if (!user || user.disabled || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: "البريد أو كلمة المرور غير صحيحة." });
  }
  req.session.regenerate(err => {
    if (err) return res.status(500).json({ error: "تعذر إنشاء الجلسة." });
    req.session.userId = user.id;
    req.session.save(saveErr => {
      if (saveErr) return res.status(500).json({ error: "تعذر حفظ الجلسة." });
      res.json({ user: cleanUser(user) });
    });
  });
});

app.post("/api/logout", (req, res) => {
  req.session.destroy(err => {
    res.clearCookie("cinema.sid", { httpOnly: true, sameSite: "lax", secure: production });
    if (err) return res.status(500).json({ error: "تعذر تسجيل الخروج." });
    res.json({ ok: true });
  });
});

app.patch("/api/profile", requireAuth, (req, res) => {
  const username = String(req.body.username || "").trim();
  const avatar = String(req.body.avatar || "").trim();
  if (!safeUsername(username)) return res.status(400).json({ error: "اسم المستخدم غير صالح." });
  if (avatar && (!/^https:\/\/(images\.unsplash\.com|.*\.unsplash\.com)\//i.test(avatar) || avatar.length > 500)) {
    return res.status(400).json({ error: "رابط الصورة غير صالح. استخدم رابط صورة HTTPS مدعوم." });
  }
  db.prepare("UPDATE users SET username = ?, avatar = ? WHERE id = ?").run(username, avatar, req.user.id);
  const updated = db.prepare("SELECT * FROM users WHERE id = ?").get(req.user.id);
  res.json({ user: cleanUser(updated) });
});

app.post("/api/favorites/:id", requireAuth, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1 || id > 1000) return res.status(400).json({ error: "رقم الحلقة غير صالح." });
  const existing = db.prepare("SELECT 1 FROM favorites WHERE user_id = ? AND episode_id = ?").get(req.user.id, id);
  if (existing) db.prepare("DELETE FROM favorites WHERE user_id = ? AND episode_id = ?").run(req.user.id, id);
  else db.prepare("INSERT INTO favorites (user_id, episode_id) VALUES (?, ?)").run(req.user.id, id);
  res.json({ favorite: !existing });
});

app.post("/api/watched/:id", requireAuth, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1 || id > 1000) return res.status(400).json({ error: "رقم الحلقة غير صالح." });
  const existing = db.prepare("SELECT 1 FROM watched WHERE user_id = ? AND episode_id = ?").get(req.user.id, id);
  if (existing) db.prepare("DELETE FROM watched WHERE user_id = ? AND episode_id = ?").run(req.user.id, id);
  else db.prepare("INSERT INTO watched (user_id, episode_id) VALUES (?, ?)").run(req.user.id, id);
  res.json({ watched: !existing });
});

/* Admin APIs: every route checks the server-side role. */
app.get("/api/admin/stats", requireAuth, requireAdmin, (req, res) => {
  res.json({
    users: db.prepare("SELECT COUNT(*) AS n FROM users").get().n,
    admins: db.prepare("SELECT COUNT(*) AS n FROM users WHERE role='admin'").get().n,
    disabled: db.prepare("SELECT COUNT(*) AS n FROM users WHERE disabled=1").get().n
  });
});
app.get("/api/admin/users", requireAuth, requireAdmin, (req, res) => {
  const users = db.prepare("SELECT id,email,username,role,avatar,created_at,disabled FROM users ORDER BY id DESC LIMIT 500").all();
  res.json({ users: users.map(u => ({...cleanUser(u), disabled: !!u.disabled})) });
});
app.patch("/api/admin/users/:id", requireAuth, requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const target = db.prepare("SELECT * FROM users WHERE id = ?").get(id);
  if (!target) return res.status(404).json({ error: "المستخدم غير موجود." });
  if (target.id === req.user.id && (req.body.role === "user" || req.body.disabled === true)) {
    return res.status(400).json({ error: "لا يمكنك إلغاء صلاحية حسابك أو تعطيله بنفسك." });
  }
  if (req.body.role !== undefined) {
    if (!["user", "admin"].includes(req.body.role)) return res.status(400).json({ error: "الصلاحية غير صالحة." });
    if (target.role === "admin" && req.body.role === "user") {
      const count = db.prepare("SELECT COUNT(*) AS n FROM users WHERE role='admin' AND disabled=0").get().n;
      if (count <= 1) return res.status(400).json({ error: "يجب وجود أدمن نشط واحد على الأقل." });
    }
    db.prepare("UPDATE users SET role=? WHERE id=?").run(req.body.role, id);
  }
  if (req.body.disabled !== undefined) {
    if (typeof req.body.disabled !== "boolean") return res.status(400).json({ error: "قيمة حالة الحساب غير صالحة." });
    if (target.role === "admin" && req.body.disabled) {
      const count = db.prepare("SELECT COUNT(*) AS n FROM users WHERE role='admin' AND disabled=0").get().n;
      if (count <= 1) return res.status(400).json({ error: "لا يمكن تعطيل آخر أدمن نشط." });
    }
    db.prepare("UPDATE users SET disabled=? WHERE id=?").run(req.body.disabled ? 1 : 0, id);
  }
  res.json({ ok: true });
});

app.get("*", (req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));

app.listen(PORT, "0.0.0.0", () => {
  console.log(`CINEMA running on port ${PORT}`);
});
