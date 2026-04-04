# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

LA-History is an educational web game about Los Angeles history. Users explore a Leaflet map of ~57 historical locations across 4 eras (Native, Spanish, Rancho, Modern), read descriptions, take quizzes, earn points/badges, and chat with a Socratic AI tutor powered by a local Ollama LLM.

## Running the App

**Backend (Flask):**
```bash
# Install dependencies
pip install -r requirements.txt

# Set up environment
cp .env .env.local  # edit as needed

# Seed the database (first time)
python seed_db.py

# Run dev server on port 5000
python run.py
```

**Frontend (React + Vite):**
```bash
cd frontend
npm install
npm run dev    # dev server on port 5173, proxies /api/* to Flask :5000
npm run build  # build to frontend/dist/
```

Vite proxies all `/api/*` requests to `http://localhost:5000`, so both servers must run during development.

**Ollama (AI chat):**
The chat feature requires a local Ollama instance running `llama3.2` at `http://localhost:11434`. Set `OLLAMA_BASE_URL` and `OLLAMA_MODEL` in `.env` to override.

## Architecture

### Backend (`app/`)

Flask 3 with modular blueprints, SQLAlchemy ORM, Flask-Login auth, CSRF protection.

- `app/__init__.py` — `create_app()` factory, registers all blueprints, serves React SPA fallback
- `app/models/` — SQLAlchemy models: User, Location, HistoricalEvent, UserProgress, Badge, UserBadge, Quiz, QuizQuestion, ChatSession, ChatMessage
- `app/routes/` — Blueprints: `auth` (login/register/logout), `map` (/api/locations), `progress` (/api/progress), `quiz` (/api/quiz), `chat` (/api/chat)
- `app/services/gamification.py` — Points/badge/era-unlock logic (10 pts visit, 50 pts quiz pass, 100 pts era complete; era unlock gates via quiz-pass thresholds)
- `app/services/ollama_service.py` — Socratic tutor; connects to local Ollama, keeps 6-message rolling context per session

### Frontend (`frontend/src/`)

React 18 SPA with React Router, Leaflet maps, Tailwind CSS.

- `App.jsx` — BrowserRouter: `/` → MapPage, `/progress` → ProgressPage, `/about` → AboutPage
- `context/AppContext.jsx` — Global state: `selectedLocation`, `completedIds`, `totalPoints`
- `components/MapContainer.jsx` — Leaflet map, restricted to Greater LA bounds
- `components/InfoPanel.jsx` — Slide-in panel for location detail, quiz, and chat

### Data Flow

1. Flask authenticates via session cookie (username-based login, Flask-Login)
2. React fetches `/api/locations` on load → renders markers with era-based unlock status
3. Clicking a marker → `selectedLocation` in context → InfoPanel opens
4. `/api/locations/<id>/visit` awards 10 pts; `/api/quiz/<id>/submit` grades and awards points
5. `/api/chat` sends message to Ollama with location context + last 6 messages as history

### Era Unlock Rules

- Era 1 (Native): always unlocked
- Era 2 (Spanish): unlocked when ≥50% of Era 1 quizzes passed
- Era 3+ (Rancho/Modern): unlocked when 100% of previous era quizzes passed

## Key Files

| File | Purpose |
|------|---------|
| `run.py` | Flask entry point |
| `seed_db.py` | Populate DB from `data/locations.json` and `data/quizzes.json` |
| `app/config.py` | Dev/prod config (SQLite dev, `DATABASE_URL` env var for prod) |
| `app/extensions.py` | Flask extensions: `db`, `login_manager`, `bcrypt`, `csrf` |
| `frontend/vite.config.js` | Proxy `/api/*` to Flask |
| `data/locations.json` | Source of truth for 57 historical locations |
| `data/quizzes.json` | Quiz questions per location |

## Environment Variables

```
SECRET_KEY=...
FLASK_ENV=development
FLASK_DEBUG=1
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2
DATABASE_URL=...  # production only; dev uses SQLite instance/la_history.db
```
