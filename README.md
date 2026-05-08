# LA-History

LA-History is an educational web game that guides players through 15 historical locations across Los Angeles, spanning the Tongva/Native, Spanish, Rancho, and Modern eras. Players explore an interactive Leaflet map, read location histories, take quizzes, build concept maps, and chat with a Socratic AI tutor powered by a local Ollama LLM. Features a points/badge economy, era-unlock progression, and ambient era-themed music — all built with Flask, SQLAlchemy, and vanilla JavaScript.

---

## Learning Theory

LA-History is grounded in constructivism, Vygotsky's Zone of Proximal Development (ZPD), and schema theory. Rather than presenting static information, the app has students actively build knowledge by exploring locations, completing quizzes, and constructing concept maps — because making connections is what produces lasting understanding, not reading facts once and moving on. The Socratic AI tutor operationalizes ZPD by responding to each student's current map state with a guiding question rather than an answer, giving just enough scaffolding to move the student forward while keeping the thinking theirs.

---

## Team

Eduardo Rebollar, Miranda Samayoa-Cobon, Joy Botros
Occidental College — COMP 395: AI and Learning Technologies

---

## AI Disclosure

The following AI tools were used in the development of this project:

- **Ollama** — Local inference engine powering the in-app AI tutor, quiz hint generator, concept map evaluator, and insight generator.
- **Claude Pro (Anthropic)** — Used to generate and edit code, brainstorm prompt rules, and debug.

All AI-generated code was reviewed, tested, and modified before implementation.

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

The chat, quiz hints, and concept map features require Ollama running locally:

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
├── run.py                      # Flask entry point
├── seed_db.py                  # Populates the DB from data/ JSON files
├── download_images.py          # Fetches Wikipedia images for locations
├── requirements.txt            # Python dependencies
├── .env                        # Environment variable template
├── .env.example                # Example env file with placeholder values
│
├── app/                        # Flask application package
│   ├── __init__.py             # App factory (create_app), blueprint registration, runtime migrations
│   ├── config.py               # Dev/prod configuration classes
│   ├── extensions.py           # Shared Flask extensions (db, login_manager, bcrypt, csrf, mail, limiter)
│   ├── models/
│   │   ├── user.py             # User account and auth (SHA-256 reset tokens)
│   │   ├── location.py         # Historical location (video_url, image_caption)
│   │   ├── progress.py         # UserProgress, Badge, UserBadge, ChatSession, ChatMessage
│   │   ├── concept_map.py      # ConceptMap (graph_json, insight_uses)
│   │   └── quiz.py             # Quiz and QuizQuestion (per-option wrong_explanation fields)
│   ├── routes/
│   │   ├── auth.py             # /login, /register, /logout, /forgot-password, /reset-password
│   │   ├── map.py              # /map (rendered template), /api/locations
│   │   ├── progress.py         # /api/progress
│   │   ├── quiz.py             # /api/quiz/<id>, /check_answer, /submit, /hint
│   │   ├── chat.py             # /api/chat
│   │   └── concept_map.py      # /api/concept_map/<era>/save, /insight, /submit
│   ├── services/
│   │   ├── gamification.py     # Points, badges, era-unlock rules
│   │   └── ollama_service.py   # Socratic tutor, quiz hints, concept map insights/evaluation
│   └── utils/                  # Shared app utilities
│
├── data/                       # Seed data and course documentation
│   ├── locations.json          # 15 historical locations with coordinates and descriptions
│   ├── quizzes.json            # Quiz questions with per-option wrong explanations
│   ├── scenarios.md            # 17 test scenarios used to evaluate all prompt versions
│   ├── user_testing_protocol.md # Structured protocol for user testing sessions
│   ├── user_testing_notes.md   # Anonymized observation notes (P1–P4)
│   ├── rubric.md               # Four-criterion scoring rubric (C1–C4, 1–4 scale)
│   ├── scores.md               # Per-version, per-scenario scores
│   └── README.md               # Data directory overview
│
├── docs/
│   ├── LA_History_Report.pdf   # Final course report
│   └── productionization.md    # Plan for deploying the app to production
│
├── prompts/                    # System prompt version history for the Socratic tutor
│   ├── system_prompt_v0.txt
│   ├── system_prompt_v1.txt
│   ├── system_prompt_v2.txt
│   ├── system_prompt_v3.txt
│   └── CHANGELOG.md            # What changed in each version and why
│
├── static/
│   ├── favicon.svg
│   ├── css/
│   │   ├── main.css            # Global styles and theming
│   │   ├── map.css             # Map page layout and marker styles
│   │   ├── chat.css            # Chat panel styles
│   │   ├── quiz.css            # Quiz modal styles
│   │   ├── concept_map.css     # Concept map canvas styles
│   │   ├── tutorial.css        # Onboarding spotlight overlay styles
│   │   ├── auth.css            # Login/register page styles
│   │   └── animations.css      # Shared keyframe animations
│   ├── img/                    # Location images (fetched by download_images.py)
│   └── js/
│       ├── map.js              # Leaflet map, marker rendering, era filter, location detail panel
│       ├── quiz.js             # Quiz modal
│       ├── concept_map.js      # Cytoscape-based concept map with Ollama evaluation
│       ├── chat.js             # Socratic tutor chat panel
│       ├── progress.js         # Progress dashboard UI
│       ├── music.js            # Web Audio API ambient music (one synthesized loop per era)
│       ├── sounds.js           # UI sound effects
│       ├── tutorial.js         # First-time onboarding walkthrough with spotlight overlays
│       ├── tts.js              # Text-to-speech for location descriptions
│       ├── voice.js            # Voice input for chat
│       ├── settings.js         # Settings modal (theme, TTS, SFX, music, font/marker size, reset)
│       └── utils.js            # Shared apiFetch wrapper and toast notifications
│
├── templates/                  # Jinja2 HTML templates
│   ├── base.html               # Base layout (nav, scripts, modals)
│   ├── auth/
│   │   ├── login.html
│   │   ├── register.html
│   │   ├── forgot_password.html
│   │   └── reset_password.html
│   ├── map/
│   │   └── index.html          # Main map page
│   └── dashboard/
│       └── index.html          # Progress dashboard page
│
├── tests/
│   ├── conftest.py             # Pytest fixtures (app factory, test client)
│   └── test_app.py             # Auth, registration, era-unlock, and points guard tests
│
└── instance/                   # Auto-created by Flask (gitignored)
    └── la_history.db           # SQLite database (dev only)
```

---

## Era Unlock Rules

| Era | Unlock Condition |
| --- | --- |
| Era 1 — Tongva/Native | Always unlocked |
| Era 2 — Spanish | All Era 1 quizzes passed **and** Era 1 concept map submitted |
| Era 3 — Rancho | All Era 2 quizzes passed **and** Era 2 concept map submitted |
| Era 4 — Modern | All Era 3 quizzes passed **and** Era 3 concept map submitted |

---

## Points & Economy

| Action | Points |
| --- | --- |
| Visit a location (first time) | +10 |
| Pass a quiz, first attempt | +quiz reward (minus hint penalty) |
| Pass a quiz, retry | +quiz reward ÷ 2 |
| Score ≥ 90% on any pass | +20 bonus |
| Submit a concept map | +75 (+25 synthesis bonus) |
| Use a quiz hint | −5 (also reduces quiz reward proportionally) |
| Use a concept map insight | −15 (max 3 uses per era) |
