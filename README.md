# Taskboard — Full Stack Task Manager

A full-stack task manager with JWT authentication, SQLite persistence, and a kanban-style UI.

## Stack

| Layer | Tech |
|-------|------|
| Frontend | Vanilla HTML/CSS/JS (zero build step) |
| Backend | Node.js + Express |
| Database | SQLite (via Node 22 built-in `node:sqlite`) |
| Auth | JWT (via `jose`) + bcrypt password hashing |

---

## Project Structure

```
taskmanager/
├── backend/
│   ├── server.js          # Express API
│   ├── package.json
│   ├── .env.example       # Copy to .env and fill in
│   └── tasks.db           # Created automatically on first run
└── frontend/
    └── index.html         # Single-file frontend
```

---

## Running Locally

### 1. Backend

```bash
cd backend
cp .env.example .env
# Edit .env — set a strong JWT_SECRET
npm install
npm start
# API is live at http://localhost:3001
```

### 2. Frontend

The frontend is a single HTML file — just open it in a browser:

```bash
# Option A: open directly
open frontend/index.html

# Option B: serve with any static server
npx serve frontend
# or
python3 -m http.server 8080 --directory frontend
```

> **Note:** Make sure the `API` constant in `frontend/index.html` matches your backend URL (default: `http://localhost:3001/api`).

---

## API Endpoints

### Auth
| Method | Path | Body | Auth | Description |
|--------|------|------|------|-------------|
| `POST` | `/api/register` | `{name, email, password}` | — | Create account |
| `POST` | `/api/login` | `{email, password}` | — | Returns JWT token |
| `GET` | `/api/me` | — | ✓ | Get current user |

### Tasks
| Method | Path | Body | Auth | Description |
|--------|------|------|------|-------------|
| `GET` | `/api/tasks` | — | ✓ | List all tasks |
| `POST` | `/api/tasks` | `{name, description?, stage?}` | ✓ | Create task |
| `PUT` | `/api/tasks/:id` | `{name?, description?, stage?}` | ✓ | Update task |
| `DELETE` | `/api/tasks/:id` | — | ✓ | Delete task |

Stages: `todo` · `prog` · `done`

---

## Deployment

### Backend → Render (free tier)

1. Push the `backend/` folder to a GitHub repo
2. Go to [render.com](https://render.com) → New Web Service
3. Connect your repo
4. Set:
   - **Build command:** `npm install`
   - **Start command:** `node server.js`
   - **Environment variables:**
     - `JWT_SECRET` → a long random string (e.g. from `openssl rand -hex 32`)
     - `PORT` → `3001` (Render sets this automatically)
     - `FRONTEND_ORIGIN` → your frontend URL

### Backend → Railway (free tier)

1. Push `backend/` to GitHub
2. New project → Deploy from GitHub
3. Add env vars (same as above)

### Frontend → Netlify (free, drag & drop)

1. Open [netlify.com](https://netlify.com)
2. Drag and drop the `frontend/` folder onto the deploy zone
3. Done — you get a live URL in seconds

### Frontend → GitHub Pages

1. Create a repo, put `index.html` in the root (or `docs/`)
2. Settings → Pages → source: main branch
3. Update the `API` constant in `index.html` to your backend URL before pushing

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | Server port |
| `JWT_SECRET` | `super-secret-dev-key-change-in-prod` | **Change this in production!** |
| `DB_PATH` | `./tasks.db` | SQLite database path |
| `FRONTEND_ORIGIN` | `*` | CORS allowed origin (set to your frontend URL in prod) |

---

## Features

- **Auth:** Register, login, persistent JWT sessions (7-day expiry), bcrypt password hashing
- **Tasks:** Create, edit, delete, move between stages
- **Stages:** Todo → In Progress → Done (with quick-move buttons on each card)
- **UI:** Responsive kanban board, loading & error states, modal dialogs, keyboard shortcuts (Enter to submit, Escape to close)
- **Security:** Passwords hashed with bcrypt (10 rounds), JWT signed with HS256, tasks scoped per user, CORS configured

---

## Notes on `node:sqlite`

This project uses Node 22's **built-in SQLite** module (`node:sqlite`), which requires no native compilation — just Node ≥ 22. It will show an `ExperimentalWarning` on startup; this is expected and safe to ignore.
