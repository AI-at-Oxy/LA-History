# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

LA-History is an educational web game about Los Angeles history. Users explore a Leaflet map of 15 historical locations across 4 eras (Tongva/Native, Spanish, Rancho, Modern), read descriptions, take quizzes, earn points/badges, and chat with a Socratic AI tutor powered by a local Ollama LLM.

## Running the App

**Backend (Flask):**

```bash
pip install -r requirements.txt
cp .env .env.local        # edit as needed
python seed_db.py         # seed DB on first run
python run.py             # dev server on port 5000
```

**Ollama (AI chat):**
Requires a local Ollama instance running `gemma4:latest` at `http://localhost:11434`. Set `OLLAMA_BASE_URL` and `OLLAMA_MODEL` in `.env` to override.

**Password reset in dev:** With no mail server configured, reset links print to the terminal when `FLASK_DEBUG=1`.

## Architecture

### Backend (`app/`)

Flask 3 with modular blueprints, SQLAlchemy ORM, Flask-Login auth, CSRF protection, Flask-Limiter rate limiting, and Flask-Mail for password reset.

- `app/__init__.py` — `create_app()` factory; registers all blueprints; applies runtime `ALTER TABLE` migrations for columns added after initial schema (image_caption, video_url, reset token fields, era_order on chat_sessions, insight_uses on concept_maps)
- `app/models/` — SQLAlchemy models: User (reset token hashing via SHA-256), Location (`video_url`/`video_caption` for YouTube embeds, `image_caption`), UserProgress, Badge, UserBadge, Quiz, QuizQuestion (with per-option wrong explanations `wrong_explanation_a/b/c/d`), ChatSession, ChatMessage, ConceptMap (stores `graph_json` as cy.json string, `insight_uses` token counter)
- `app/routes/` — Blueprints: `auth` (login/register/logout/forgot-password/reset-password), `map`, `progress`, `quiz`, `chat`, `concept_map`
- `app/services/gamification.py` — All points/badge/era-unlock logic
- `app/services/ollama_service.py` — All Ollama interactions: Socratic tutor, quiz hints, concept map insights, concept map evaluation; each is a separate prompt function returning `(result, error)`

### Points & Economy

| Action | Points |
| ------ | ------ |
| Visit location (first time) | +10 |
| Pass quiz, first attempt | +`quiz.points_reward` (minus hint penalty) |
| Pass quiz, retry | +`quiz.points_reward // 2` |
| Score ≥90% on any pass | +20 bonus |
| Submit concept map | +75 (+25 bonus) |
| Quiz hint | −5 (also reduces quiz reward proportionally) |
| Concept map insight | −15 (max 3 uses per era) |

### Era Unlock Rules

Era 1 (Tongva/Native) is always unlocked. Each subsequent era requires **all quizzes in the previous era passed AND the previous era's concept map submitted**. Enforced in `is_location_unlocked()` and `is_era_unlocked_for_user()` in `gamification.py`.

### Ollama Service Details

All Ollama calls in `ollama_service.py` are stateless functions — no shared state between calls.

- **Tutor chat**: rolling 6-message context window, 17-rule Socratic system prompt (`CONCEPT_MAP_CHAT_PROMPT` constant in `ollama_service.py`, versioned in `prompts/system_prompt_v3.txt`); key rules: never state historical facts (rule 1), always close with one map-specific question (rule 2), prefer causal/comparative questions over selection/recall (rule 3), probe prior knowledge first (rule 10), escalate deflections with a new question (rule 11), interrogate vague edge labels (rule 12), reject minimal replies and anchor to map (rule 13), two-turn misconception protocol (rule 14), vary openers across turns (rule 16)
- **Quiz hints**: 2-3 sentence contextual clue without revealing the answer; points refunded on Ollama failure
- **Concept map insights**: direct hints (not Socratic), max 3 per era
- **Concept map evaluation**: returns JSON with `edge_feedback`, `overall_comment`, `synthesis_score` (0-100), `follow_up_question`; has JSON decode fallback

### Frontend (`static/js/`)

Vanilla JS, no bundler. Each file is a self-contained IIFE or set of globals loaded via `<script>` tags.

- `map.js` — Leaflet map init, marker rendering, era filter, location detail panel, visit API calls
- `quiz.js` — Quiz modal (shared file); per-question answer checking via `/api/quiz/check_answer`; hint loading
- `music.js` — `MusicPlayer` IIFE; Web Audio API synthesized ambient loops (no audio files, pure oscillators); one loop per era; ducks during SFX; persists enabled/volume to localStorage; resumes on user gesture or tab visibility change
- `sounds.js` — `SFX` object for UI sound effects
- `concept_map.js` — Cytoscape-based concept map; per-era; Ollama-evaluated on submit; insight token UI; calls `window.refreshMapMarkers()` after a successful submit so next-era locations unlock immediately without a page reload
- `tutorial.js` — First-time onboarding walkthrough with spotlight overlays; auto-pops on first login and whenever the server sets `FORCE_TUTORIAL = true` (injected by `map.py` for returning users flagged for re-onboarding); forced run clears `tutorial_completed` and `cm_tutorial_completed` from localStorage
- `chat.js` — Socratic tutor chat panel
- `tts.js` — Text-to-speech for location descriptions
- `voice.js` — Voice input (mic button in chat)
- `settings.js` — Settings modal (theme, TTS, SFX, music toggle/volume, font/marker size, reset progress)
- `utils.js` — Shared `apiFetch` wrapper and toast notifications

### Data Flow

1. Flask session cookie auth (Flask-Login)
2. `map.js` fetches `/api/locations` → renders markers with era lock/unlock status
3. Clicking a marker → `/api/locations/<id>` → detail panel → `/api/locations/<id>/visit` (+10 pts)
4. Quiz: `/api/quiz/<id>` → per-question `/api/quiz/check_answer` → `/api/quiz/<id>/submit`; hints via `/api/quiz/<id>/hint`
5. Chat: `/api/chat` with location context + rolling 6-message history → Ollama
6. Concept map: auto-saved to `/api/concept_map/<era>/save`; insights via `/api/concept_map/<era>/insight`; submitted to `/api/concept_map/<era>/submit` for Ollama evaluation

## Key Files

| File | Purpose |
| ---- | ------- |
| `run.py` | Flask entry point |
| `seed_db.py` | Populate DB from `data/locations.json` and `data/quizzes.json` |
| `app/config.py` | Dev/prod config (SQLite dev, `DATABASE_URL` env var for prod) |
| `app/extensions.py` | Flask extensions: `db`, `login_manager`, `bcrypt`, `csrf`, `mail`, `limiter` |
| `data/locations.json` | Source of truth for 15 historical locations |
| `data/quizzes.json` | Quiz questions per location (includes `wrong_explanation_a/b/c/d`) |
| `download_images.py` | Fetches Wikipedia images for locations, saves to `static/img/` |

## Environment Variables

```env
SECRET_KEY=...
FLASK_ENV=development
FLASK_DEBUG=1
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=gemma4:latest
DATABASE_URL=...              # production only; dev uses SQLite instance/la_history.db
MAIL_SERVER=...               # optional; required for password reset emails in prod
MAIL_PORT=587
MAIL_USE_TLS=true
MAIL_USERNAME=...
MAIL_PASSWORD=...
MAIL_DEFAULT_SENDER=...
PASSWORD_RESET_EXPIRY_SECONDS=3600
```
