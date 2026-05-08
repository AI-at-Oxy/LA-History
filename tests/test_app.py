"""
Tests covering routing, auth, session management, and core data structures.
No LLM calls are made in any of these tests.
"""


# --- Routing ---

def test_locations_api_requires_auth(client):
    rv = client.get('/api/locations')
    assert rv.status_code == 302
    assert 'login' in rv.headers['Location']


# --- Registration / Auth ---

def test_register_password_mismatch(client):
    rv = client.post('/register', data={
        'username': 'mismatch_user',
        'email': 'mismatch@test.com',
        'password': 'Password1!',
        'confirm_password': 'Different1!',
    }, follow_redirects=True)
    assert rv.status_code == 200
    assert b'do not match' in rv.data


def test_register_duplicate_username(app, client):
    from app.extensions import db as _db, bcrypt
    from app.models.user import User
    with app.app_context():
        pw = bcrypt.generate_password_hash('Password1!').decode('utf-8')
        _db.session.add(User(username='dupuser', email='dup1@test.com', password_hash=pw))
        _db.session.commit()
    rv = client.post('/register', data={
        'username': 'dupuser',
        'email': 'dup2@test.com',
        'password': 'Password1!',
        'confirm_password': 'Password1!',
    }, follow_redirects=True)
    assert rv.status_code == 200
    assert b'already taken' in rv.data


def test_register_weak_password(client):
    rv = client.post('/register', data={
        'username': 'weakpw_user',
        'email': 'weak@test.com',
        'password': 'short',
        'confirm_password': 'short',
    }, follow_redirects=True)
    assert rv.status_code == 200
    assert b'at least 8 characters' in rv.data


# --- Model: password reset token ---

def test_reset_token_expires(app):
    import secrets
    from app.models.user import User
    u = User(username='exptest', email='exp@test.com',
             total_points=0, password_hash='placeholder')
    token = secrets.token_urlsafe(32)
    u.set_reset_token(token, expiry_seconds=-1)   # immediately expired
    assert u.verify_reset_token(token) is False


# --- Service: gamification ---

def test_spend_points_insufficient(app):
    from app.models.user import User
    from app.services.gamification import spend_points
    u = User(username='spendtest', email='spend@test.com',
             total_points=3, password_hash='placeholder')
    success, msg = spend_points(u, 10)
    assert success is False
    assert msg  # non-empty error string


def test_era1_starter_location_always_unlocked(app):
    from app.models.location import Location
    from app.services.gamification import is_location_unlocked
    loc = Location(
        name='Test Village', slug='test-village',
        latitude=34.0, longitude=-118.0,
        era='Tongva', era_order=1,
        short_description='A test site.',
        full_description='A test site with more detail.',
        is_starter=True,
    )
    assert is_location_unlocked(user_id=9999, location=loc) is True
