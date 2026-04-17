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
- `app/models/` — SQLAlchemy models: User, Location (includes `video_url`/`video_caption` for YouTube embeds), HistoricalEvent, UserProgress, Badge, UserBadge, Quiz, QuizQuestion, ChatSession, ChatMessage, ConceptMap
- `app/routes/` — Blueprints: `auth` (login/register/logout), `map` (/api/locations), `progress` (/api/progress), `quiz` (/api/quiz), `chat` (/api/chat), `concept_map` (/api/concept_map), `memory_challenge` (/api/memory_challenge)
- `app/services/gamification.py` — Points/badge/era-unlock logic; visit=10 pts; quiz pass first=50, retry=25, +20 bonus ≥90%; concept map submit=75 (+25 bonus); era complete=100; scaffolding currency: hints=5 pts, insights=15 pts (max 3/quiz); Memory Challenge costs 30 pts, rewards 120 pts (80% threshold); era unlock gates via quiz-pass thresholds
- `app/services/ollama_service.py` — Socratic tutor + concept map evaluation + Memory Challenge question generation; connects to local Ollama, keeps 6-message rolling context per session

### Frontend (`templates/` + `static/`)

Flask-rendered Jinja2 templates with vanilla JS and custom CSS.

- `templates/map/index.html` — Main map page (sidebar, Leaflet map, detail panel, quiz modal, chat)
- `templates/dashboard/index.html` — Progress dashboard
- `templates/auth/` — Login, register, forgot-password, reset-password forms
- `templates/base.html` — Base layout (navbar, settings modal, flash messages)
- `static/js/map.js` — Leaflet map init, marker rendering, location detail (includes YouTube embed for `video_url`)
- `static/js/quiz.js` — Quiz modal logic
- `static/js/chat.js` — Socratic tutor chat panel
- `static/js/progress.js` — Era progress and badge display
- `static/js/concept_map.js` — Cytoscape-based concept map (per-era, Ollama-evaluated)
- `static/js/tutorial.js` — First-time user onboarding walkthrough
- `static/js/tts.js` — Text-to-speech for location descriptions
- `static/js/voice.js` — Voice input module (mic button in chat)
- `static/js/sounds.js` — Sound effects
- `static/js/settings.js` — Settings modal (theme, TTS, SFX, font/marker size, reset progress)
- `static/js/utils.js` — Shared utilities
- `static/css/main.css` — Global styles and theme variables
- `static/css/map.css`, `quiz.css`, `chat.css`, `auth.css` — Component styles
- `static/css/concept_map.css` — Concept map panel styles
- `static/css/tutorial.css` — Tutorial overlay and spotlight styles
- `static/css/animations.css` — Transition and animation definitions

### Data Flow

1. Flask authenticates via session cookie (username-based login, Flask-Login)
2. `map.js` fetches `/api/locations` on load → renders markers with era-based unlock status
3. Clicking a marker calls `/api/locations/<id>` → populates detail panel
4. `/api/locations/<id>/visit` awards 10 pts; `/api/quiz/<id>/submit` grades and awards points; `/api/quiz/<id>/hint` costs 5 pts; `/api/quiz/<id>/insight` costs 15 pts (max 3/quiz)
5. `/api/chat` sends message to Ollama with location context + last 6 messages as history
6. `/api/concept_map/<era>/submit` evaluates concept map via Ollama, awards 75 pts (+25 bonus)
7. `/api/memory_challenge/<era>/start` + `/submit` — unlocked after era complete + concept map submitted; costs 30 pts to start, rewards 120 pts at ≥80%

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
| `data/locations.json` | Source of truth for 57 historical locations (includes `video_url`/`video_caption`) |
| `data/quizzes.json` | Quiz questions per location (includes wrong-answer explanations) |
| `download_images.py` | Utility script: fetches Wikipedia images for locations, saves to `static/img/` |
| `static/favicon.svg` | Browser tab icon (compass design) |

## Environment Variables

```
SECRET_KEY=...
FLASK_ENV=development
FLASK_DEBUG=1
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2
DATABASE_URL=...  # production only; dev uses SQLite instance/la_history.db
```
