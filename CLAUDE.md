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

**Ollama (AI chat):**
The chat feature requires a local Ollama instance running `llama3.2` at `http://localhost:11434`. Set `OLLAMA_BASE_URL` and `OLLAMA_MODEL` in `.env` to override.

## Architecture

### Backend (`app/`)

Flask 3 with modular blueprints, SQLAlchemy ORM, Flask-Login auth, CSRF protection.

- `app/__init__.py` — `create_app()` factory, registers all blueprints, redirects `/` to `/map`
- `app/models/` — SQLAlchemy models: User, Location, HistoricalEvent, UserProgress, Badge, UserBadge, Quiz, QuizQuestion, ChatSession, ChatMessage
- `app/routes/` — Blueprints: `auth` (login/register/logout), `map` (/api/locations), `progress` (/api/progress), `quiz` (/api/quiz), `chat` (/api/chat)
- `app/services/gamification.py` — Points/badge/era-unlock logic (10 pts visit, 50 pts quiz pass, 100 pts era complete; era unlock gates via quiz-pass thresholds)
- `app/services/ollama_service.py` — Socratic tutor; connects to local Ollama, keeps 6-message rolling context per session

### Frontend (`templates/` + `static/`)

Flask-rendered Jinja2 templates with vanilla JS and custom CSS.

- `templates/map/index.html` — Main map page (sidebar, Leaflet map, detail panel, quiz modal, chat)
- `templates/auth/` — Login and register forms
- `templates/base.html` — Base layout
- `static/js/map.js` — Leaflet map init, marker rendering, location detail
- `static/js/quiz.js` — Quiz modal logic
- `static/js/chat.js` — Socratic tutor chat panel
- `static/js/progress.js` — Era progress and badge display

### Data Flow

1. Flask authenticates via session cookie (username-based login, Flask-Login)
2. `map.js` fetches `/api/locations` on load → renders markers with era-based unlock status
3. Clicking a marker calls `/api/locations/<id>` → populates detail panel
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
