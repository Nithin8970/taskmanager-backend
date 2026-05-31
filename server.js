import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import { DatabaseSync } from 'node:sqlite';
import { SignJWT, jwtVerify } from 'jose';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import 'dotenv/config';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'super-secret-dev-key-change-in-prod');

// ─── DB SETUP ────────────────────────────────────────────────────────────────
const db = new DatabaseSync(process.env.DB_PATH || join(__dirname, 'tasks.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    created_at INTEGER DEFAULT (unixepoch())
  );
  CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    stage TEXT NOT NULL CHECK(stage IN ('todo','prog','done')) DEFAULT 'todo',
    created_at INTEGER DEFAULT (unixepoch()),
    updated_at INTEGER DEFAULT (unixepoch())
  );
`);

// ─── MIDDLEWARE ───────────────────────────────────────────────────────────────
app.use(cors({ origin: process.env.FRONTEND_ORIGIN || '*', credentials: true }));
app.use(express.json());

// JWT auth middleware
async function auth(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const { payload } = await jwtVerify(header.slice(7), JWT_SECRET);
    req.userId = payload.sub;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// ─── AUTH ROUTES ─────────────────────────────────────────────────────────────
app.post('/api/register', async (req, res) => {
  const { name, email, password } = req.body;
  if (!name?.trim() || !email?.trim() || !password) {
    return res.status(400).json({ error: 'Name, email and password are required' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
  if (existing) return res.status(409).json({ error: 'Email already registered' });

  const hashed = await bcrypt.hash(password, 10);
  db.prepare('INSERT INTO users (name, email, password) VALUES (?, ?, ?)')
    .run(name.trim(), email.toLowerCase(), hashed);

  res.status(201).json({ message: 'Account created successfully' });
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase());
  if (!user) return res.status(401).json({ error: 'Invalid email or password' });

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return res.status(401).json({ error: 'Invalid email or password' });

  const token = await new SignJWT({ sub: String(user.id), name: user.name, email: user.email })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(JWT_SECRET);

  res.json({ token, user: { id: user.id, name: user.name, email: user.email } });
});

app.get('/api/me', auth, (req, res) => {
  const user = db.prepare('SELECT id, name, email, created_at FROM users WHERE id = ?').get(req.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
});

// ─── TASK ROUTES ─────────────────────────────────────────────────────────────
app.get('/api/tasks', auth, (req, res) => {
  const tasks = db.prepare(
    'SELECT * FROM tasks WHERE owner_id = ? ORDER BY created_at DESC'
  ).all(req.userId);
  res.json(tasks);
});

app.post('/api/tasks', auth, (req, res) => {
  const { name, description = '', stage = 'todo' } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Task name is required' });
  if (!['todo', 'prog', 'done'].includes(stage)) return res.status(400).json({ error: 'Invalid stage' });

  const id = `t_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  db.prepare(
    'INSERT INTO tasks (id, owner_id, name, description, stage) VALUES (?, ?, ?, ?, ?)'
  ).run(id, req.userId, name.trim(), description.trim(), stage);

  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  res.status(201).json(task);
});

app.put('/api/tasks/:id', auth, (req, res) => {
  const task = db.prepare('SELECT * FROM tasks WHERE id = ? AND owner_id = ?').get(req.params.id, req.userId);
  if (!task) return res.status(404).json({ error: 'Task not found' });

  const { name, description, stage } = req.body;
  if (stage && !['todo', 'prog', 'done'].includes(stage)) return res.status(400).json({ error: 'Invalid stage' });

  db.prepare(`
    UPDATE tasks SET
      name = ?,
      description = ?,
      stage = ?,
      updated_at = unixepoch()
    WHERE id = ? AND owner_id = ?
  `).run(
    name?.trim() ?? task.name,
    description?.trim() ?? task.description,
    stage ?? task.stage,
    req.params.id,
    req.userId
  );

  res.json(db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id));
});

app.delete('/api/tasks/:id', auth, (req, res) => {
  const result = db.prepare('DELETE FROM tasks WHERE id = ? AND owner_id = ?').run(req.params.id, req.userId);
  if (result.changes === 0) return res.status(404).json({ error: 'Task not found' });
  res.json({ deleted: true });
});

// ─── HEALTH CHECK ─────────────────────────────────────────────────────────────
app.get('/api/health', (_, res) => res.json({ status: 'ok', ts: Date.now() }));

// ─── START ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`✓ Taskboard API running on http://localhost:${PORT}`);
});
