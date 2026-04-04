# Login Page Specification

## Overview

The login page gates access to the LA-History educational game behind username + password authentication. It is rendered server-side via Jinja2 (`templates/auth/login.html`) and sits outside the React SPA. After a successful login the user is redirected into the React app at `/map`.

---

## UI Requirements

### Form Fields

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Username | `text` | Yes | Autofocus on page load |
| Password | `password` | Yes | |
| Keep me signed in | `checkbox` | No | Controls persistent cookie |

### Additional Elements

- **Submit button** — "Sign In" label
- **Error message area** — displays flash messages above the form (e.g. "Invalid username or password")
- **Register link** — "Don't have an account? Register" → `/register`
- **CSRF hidden input** — `{{ csrf_token() }}`

### Visual Design

Matches the existing art-deco theme in `static/css/auth.css`:
- Background: dark with gold/amber accent colors
- Card layout centered on screen
- Input borders with warm highlight on focus

### Accessibility

- Every `<input>` has an associated `<label>` (either explicit `for`/`id` pairing or wrapping)
- `autofocus` attribute on the username input
- Error messages are visible inline, not only conveyed through color

---

## Validation Rules

All rules are enforced **both** client-side (HTML5 attributes) and server-side (Python).

| Field | Rule | Client-side | Server-side |
|-------|------|-------------|-------------|
| Username | 3–20 characters | `minlength="3" maxlength="20"` | `len(username) in range(3, 21)` |
| Username | Alphanumeric + underscore only | `pattern="^[a-zA-Z0-9_]+$"` | `re.match(r'^[a-zA-Z0-9_]+$', username)` |
| Password | Minimum 8 characters | `minlength="8"` | `len(password) >= 8` |

---

## Authentication Flow

```
GET /login
  └─► render templates/auth/login.html

POST /login  (app/routes/auth.py)
  ├─ 1. Read username + password from form data
  ├─ 2. Query: user = User.query.filter_by(username=username).first()
  ├─ 3. If user is None OR bcrypt.check_password_hash(user.password_hash, password) is False:
  │       flash("Invalid username or password")
  │       re-render login form (HTTP 200, do not reveal which field was wrong)
  └─ 4. On success:
         remember = bool(request.form.get('remember'))
         login_user(user, remember=remember)
         next_url = request.args.get('next') or url_for('map.index')
         redirect(next_url)
```

**Redirect safety:** validate that `next` is a relative path before redirecting to prevent open-redirect attacks.

---

## Persistent Sessions

### Behavior

| "Keep me signed in" | Cookie type | Expires |
|--------------------|-------------|---------|
| Checked | Persistent remember-me cookie | 30 days from login |
| Unchecked | Session cookie | On browser close |

### Required Config (`app/config.py`)

The following values must be set in the `Config` class. They are **not currently present** and must be added:

```python
from datetime import timedelta

class Config:
    # ... existing keys ...
    PERMANENT_SESSION_LIFETIME = timedelta(days=1)      # base session lifetime
    REMEMBER_COOKIE_DURATION   = timedelta(days=30)     # persistent login lifetime
    REMEMBER_COOKIE_SECURE     = True                   # HTTPS only (set False in dev if needed)
    REMEMBER_COOKIE_HTTPONLY   = True                   # not accessible via JS
    SESSION_COOKIE_SAMESITE    = 'Lax'                  # mitigates CSRF for cross-site navigations
```

> **Dev note:** `REMEMBER_COOKIE_SECURE = True` requires HTTPS. Override to `False` in a `DevelopmentConfig` subclass if testing over plain HTTP.

---

## Security Requirements

| Requirement | Implementation |
|-------------|---------------|
| CSRF protection | `{{ csrf_token() }}` hidden input on every form POST; validated by Flask-WTF |
| Password storage | bcrypt hash via Flask-Bcrypt; never stored or logged as plaintext |
| Generic error messages | Same message for wrong username and wrong password to prevent username enumeration |
| Cookie flags | `HttpOnly`, `SameSite=Lax`; `Secure` in production |
| Rate limiting | **Future work** — add per-IP lockout after N failed attempts (not yet implemented) |

---

## Protected Routes

All routes below require an authenticated session. Unauthenticated requests redirect to `/login?next=<original_url>`.

- `GET /map` — React SPA entry point
- `GET /api/locations` — location list
- `GET /api/locations/<id>` — single location
- `POST /api/locations/<id>/visit` — record visit
- `GET /api/progress` — user progress
- `POST /api/quiz/<id>/submit` — submit quiz
- `POST /api/chat` — AI chat

Enforced by `@login_required` (Flask-Login) on each route.

---

## Session Check Endpoint (Future Work)

The React SPA currently has no way to verify session state without making a data request. A future implementation should add:

```
GET /api/auth/me
  ├─ Authenticated → 200 { "id": 1, "username": "...", "total_points": 120 }
  └─ Not authenticated → 401 { "error": "Not authenticated" }
```

This allows React to redirect to `/login` gracefully when a session expires mid-use.

---

## Related Files

| File | Role |
|------|------|
| `templates/auth/login.html` | Login form template |
| `templates/auth/register.html` | Registration form template |
| `app/routes/auth.py` | Login/register/logout route handlers |
| `app/models/user.py` | User schema (id, username, password_hash, ...) |
| `app/config.py` | Session and cookie configuration |
| `app/__init__.py` | Flask-Login initialization (`login_manager`) |
| `static/css/auth.css` | Auth page styles |
