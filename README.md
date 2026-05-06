# LA-History

LA-History is an educational web game that guides players through 15 historical locations across Los Angeles, spanning the Tongva/Native, Spanish, Rancho, and Modern eras. Players explore an interactive Leaflet map, read location histories, take quizzes, build concept maps, and chat with a Socratic AI tutor powered by a local Ollama LLM. Features a points/badge economy, era-unlock progression, Memory Challenge mode, and ambient era-themed music — all built with Flask, SQLAlchemy, and vanilla JavaScript.

---

## Prerequisites

- Python 3.10+
- [Ollama](https://ollama.com) with the `gemma4:latest` model pulled (`ollama pull gemma4:latest`)

No Node.js or build step required — the frontend is vanilla JavaScript served directly by Flask.

---

## Setup & Running

### 1. Backend (Flask)

```bash
# Create a virtual environment (recommended)
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install Python dependencies
pip install -r requirements.txt

# Copy and edit environment variables
cp .env .env.local

# Seed the database (first time only)
python seed_db.py

# Start the Flask dev server on port 5000
python run.py
```

Open `http://localhost:5000` in your browser.

### 2. AI Chat (Ollama)

The chat, quiz hints, concept map insights, and Memory Challenge features require Ollama running locally:

```bash
ollama serve                   # starts the Ollama server on port 11434
ollama pull gemma4:latest      # download the model (first time only)
```

Override defaults in `.env`:

```env
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=gemma4:latest
```

**Password reset in dev:** With no mail server configured, reset links print to the terminal when `FLASK_DEBUG=1`.

---

## Environment Variables

| Variable | Description |
| --- | --- |
| `SECRET_KEY` | Flask session secret |
| `FLASK_ENV` | `development` or `production` |
| `FLASK_DEBUG` | `1` to enable debug mode |
| `OLLAMA_BASE_URL` | Ollama server URL (default: `http://localhost:11434`) |
| `OLLAMA_MODEL` | Model name (default: `gemma4:latest`) |
| `DATABASE_URL` | Production DB URL; dev uses SQLite at `instance/la_history.db` |
| `MAIL_SERVER` | SMTP server for password reset emails (optional in dev) |
| `MAIL_PORT` | SMTP port (default: `587`) |
| `MAIL_USE_TLS` | `true` to enable TLS |
| `MAIL_USERNAME` | SMTP username |
| `MAIL_PASSWORD` | SMTP password |
| `MAIL_DEFAULT_SENDER` | From address for outgoing emails |
| `PASSWORD_RESET_EXPIRY_SECONDS` | Reset link TTL (default: `3600`) |

---

## Project Structure

```text
LA-History/
├── run.py                  # Flask entry point
├── seed_db.py              # Populates the DB from data/ JSON files
├── download_images.py      # Fetches Wikipedia images for locations
├── requirements.txt        # Python dependencies
├── .env                    # Environment variable template
│
├── app/                    # Flask application package
│   ├── __init__.py         # App factory (create_app), blueprint registration, migrations
│   ├── config.py           # Dev/prod configuration classes
│   ├── extensions.py       # Shared Flask extensions (db, login_manager, bcrypt, csrf, mail, limiter)
│   ├── models/             # SQLAlchemy ORM models
│   │   ├── user.py         # User account and authentication (SHA-256 reset tokens)
│   │   ├── location.py     # Historical location (video_url, image_caption)
│   │   ├── progress.py     # UserProgress, Badge, UserBadge, ChatSession, ChatMessage,
│   │   │                   #   ConceptMap (graph_json, insight_uses), MemoryChallengeAttempt
│   │   └── quiz.py         # Quiz and QuizQuestion (per-option wrong_explanation fields)
│   ├── routes/             # Flask blueprints
│   │   ├── auth.py         # /login, /register, /logout, /forgot-password, /reset-password
│   │   ├── map.py          # /map (Flask-rendered template), /api/locations
│   │   ├── progress.py     # /api/progress
│   │   ├── quiz.py         # /api/quiz/<id>, /api/quiz/check_answer, /api/quiz/<id>/submit, /hint
│   │   ├── chat.py         # /api/chat
│   │   ├── concept_map.py  # /api/concept_map/<era>/save, /insight, /submit
│   │   └── memory_challenge.py  # /api/memory_challenge/<era>/start, /submit
│   └── services/           # Business logic
│       ├── gamification.py     # Points, badges, era-unlock rules
│       └── ollama_service.py   # Socratic tutor, quiz hints, concept map insights/evaluation,
│                               #   Memory Challenge question generation
│
├── data/                   # Seed data (source of truth)
│   ├── locations.json      # 15 historical locations with coordinates and descriptions
│   └── quizzes.json        # Quiz questions with per-option wrong explanations
│
├── static/
│   ├── img/                # Location images (fetched by download_images.py)
│   └── js/
│       ├── map.js          # Leaflet map, marker rendering, era filter, location detail panel
│       ├── quiz.js         # Quiz modal and Memory Challenge modal
│       ├── concept_map.js  # Cytoscape-based concept map with Ollama evaluation
│       ├── chat.js         # Socratic tutor chat panel
│       ├── music.js        # Web Audio API ambient music (one synthesized loop per era)
│       ├── sounds.js       # UI sound effects
│       ├── tutorial.js     # First-time onboarding walkthrough with spotlight overlays
│       ├── tts.js          # Text-to-speech for location descriptions
│       ├── voice.js        # Voice input for chat
│       ├── settings.js     # Settings modal (theme, TTS, SFX, music, font/marker size, reset)
│       └── utils.js        # Shared apiFetch wrapper and toast notifications
│
├── templates/              # Jinja2 HTML templates
│
└── instance/               # Auto-created by Flask (gitignored)
    └── la_history.db       # SQLite database (dev only)
```

---

## Era Unlock Rules

| Era | Unlock Condition |
| --- | --- |
| Era 1 — Tongva/Native | Always unlocked |
| Era 2 — Spanish | All Era 1 quizzes passed **and** Era 1 concept map submitted |
| Era 3 — Rancho | All Era 2 quizzes passed **and** Era 2 concept map submitted |
| Era 4 — Modern | All Era 3 quizzes passed **and** Era 3 concept map submitted |

Memory Challenge eligibility: all quizzes passed + concept map submitted for that era. One attempt per era.

---

## Points & Economy

| Action | Points |
| --- | --- |
| Visit a location (first time) | +10 |
| Pass a quiz, first attempt | +quiz reward (minus hint penalty) |
| Pass a quiz, retry | +quiz reward ÷ 2 |
| Score ≥ 90% on any pass | +20 bonus |
| Submit a concept map | +75 (+25 synthesis bonus) |
| Start a Memory Challenge | −30 (non-refundable) |
| Pass a Memory Challenge | +120 |
| Use a quiz hint | −5 (also reduces quiz reward proportionally) |
| Use a concept map insight | −15 (max 3 uses per era) |
