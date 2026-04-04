# LA-History

An educational web game about Los Angeles history. Users explore an interactive map of ~57 historical locations across 4 eras (Native, Spanish, Rancho, Modern), read descriptions, take quizzes, earn points and badges, and chat with a Socratic AI tutor powered by a local Ollama LLM.

---

## Prerequisites

- Python 3.10+
- Node.js 18+
- [Ollama](https://ollama.com) with the `gemma4:e2b` model pulled (`ollama pull gemma4:e2b`)

---

## Setup & Running

### 1. Backend (Flask)

```bash

# Create an virtual environment

# Install Python dependencies
pip install -r requirements.txt

# Copy and edit environment variables
cp .env .env.local

# Seed the database (first time only)
python seed_db.py

# Start the Flask dev server on port 5000
python run.py
```

### 2. Frontend (React + Vite)

```bash
cd frontend

# Install Node dependencies
npm install

# Start the Vite dev server on port 5173
npm run dev
```

Vite proxies all `/api/*` requests to `http://localhost:5000`, so **both servers must be running** during development. Open `http://localhost:5173` in your browser.

To build the frontend for production:

```bash
npm run build   # outputs to frontend/dist/
```

### 3. AI Chat (Ollama)

The chat feature requires Ollama running locally:

```bash
ollama serve            # starts the Ollama server on port 11434
ollama pull gemma4:e2b  # download the model (first time only)
```

Override defaults in `.env`:

```
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=gemma4:e2b
```

---

## Environment Variables

| Variable | Description |
|---|---|
| `SECRET_KEY` | Flask session secret |
| `FLASK_ENV` | `development` or `production` |
| `FLASK_DEBUG` | `1` to enable debug mode |
| `OLLAMA_BASE_URL` | Ollama server URL (default: `http://localhost:11434`) |
| `OLLAMA_MODEL` | Model name (default: `gemma4:e2b`) |
| `DATABASE_URL` | Production DB URL; dev uses SQLite at `instance/la_history.db` |

---

## Project Structure

```
LA-History/
├── run.py                  # Flask entry point
├── seed_db.py              # Populates the DB from data/ JSON files
├── requirements.txt        # Python dependencies
├── .env                    # Environment variable template
│
├── app/                    # Flask application package
│   ├── __init__.py         # App factory (create_app), blueprint registration
│   ├── config.py           # Dev/prod configuration classes
│   ├── extensions.py       # Shared Flask extensions (db, login_manager, bcrypt, csrf)
│   ├── models/             # SQLAlchemy ORM models
│   │   ├── user.py         # User account and authentication
│   │   ├── location.py     # Historical location and HistoricalEvent
│   │   ├── progress.py     # UserProgress, Badge, UserBadge, ChatSession, ChatMessage
│   │   └── quiz.py         # Quiz and QuizQuestion
│   ├── routes/             # Flask blueprints (API + HTML routes)
│   │   ├── auth.py         # /login, /register, /logout
│   │   ├── map.py          # /map (Flask-rendered template), /api/locations
│   │   ├── progress.py     # /api/progress
│   │   ├── quiz.py         # /api/quiz/<id>/submit
│   │   └── chat.py         # /api/chat
│   └── services/           # Business logic
│       ├── gamification.py # Points, badges, and era-unlock rules
│       └── ollama_service.py # Socratic AI tutor via local Ollama
│
├── data/                   # Seed data (source of truth)
│   ├── locations.json      # 57 historical locations with coordinates and descriptions
│   └── quizzes.json        # Quiz questions keyed by location ID
│
├── static/                 # Static assets served by Flask
│   └── js/
│       ├── chat.js         # Client-side chat UI logic
│       └── tts.js          # Text-to-speech functionality
│
├── frontend/               # React + Vite SPA
│   ├── vite.config.js      # Vite config; proxies /api/* to Flask :5000
│   ├── package.json
│   └── src/
│       ├── main.jsx        # React entry point
│       ├── App.jsx         # Router: / → MapPage, /progress → ProgressPage, /about → AboutPage
│       ├── index.css       # Global styles (Tailwind)
│       ├── context/
│       │   └── AppContext.jsx   # Global state: selectedLocation, completedIds, totalPoints
│       ├── components/
│       │   ├── MapContainer.jsx # Leaflet map, restricted to Greater LA bounds
│       │   ├── InfoPanel.jsx    # Slide-in panel: location detail, quiz, and chat
│       │   ├── LocationMarker.jsx # Individual map marker with era-based styling
│       │   ├── NavBar.jsx       # Top navigation bar
│       │   └── Sidebar.jsx      # Sidebar UI element
│       ├── pages/
│       │   ├── MapPage.jsx      # Main map view
│       │   ├── ProgressPage.jsx # Points, badges, and era progress overview
│       │   └── AboutPage.jsx    # Project information
│       └── data/
│           └── locations.js     # Client-side location data helpers
│
└── instance/               # Auto-created by Flask (gitignored)
    └── la_history.db       # SQLite database (dev only)
```

---

## Era Unlock Rules

| Era | Unlock Condition |
|---|---|
| Era 1 — Native | Always unlocked |
| Era 2 — Spanish | At least 50% of Era 1 quizzes passed |
| Era 3 — Rancho | 100% of Era 2 quizzes passed |
| Era 4 — Modern | 100% of Era 3 quizzes passed |

## Scoring

| Action | Points |
|---|---|
| Visit a location | +10 |
| Pass a quiz | +50 |
| Complete all locations in an era | +100 |
