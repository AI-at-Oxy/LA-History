import hashlib
import secrets
from datetime import datetime, timezone, timedelta
from flask_login import UserMixin
from ..extensions import db, login_manager


class User(UserMixin, db.Model):
    __tablename__ = 'users'

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    total_points = db.Column(db.Integer, default=0, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    last_seen = db.Column(db.DateTime, nullable=True)

    # Password reset token fields
    reset_token_hash = db.Column(db.String(64), nullable=True)
    reset_token_expires = db.Column(db.DateTime, nullable=True)
    reset_token_used = db.Column(db.Boolean, default=False, nullable=True)

    # Relationships
    progress = db.relationship('UserProgress', backref='user', lazy='dynamic', cascade='all, delete-orphan')
    chat_sessions = db.relationship('ChatSession', backref='user', lazy='dynamic', cascade='all, delete-orphan')
    badges = db.relationship('UserBadge', backref='user', lazy='dynamic', cascade='all, delete-orphan')

    def set_reset_token(self, raw_token, expiry_seconds):
        """Hash and store a reset token with an expiry timestamp."""
        self.reset_token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
        self.reset_token_expires = datetime.now(timezone.utc) + timedelta(seconds=expiry_seconds)
        self.reset_token_used = False

    def verify_reset_token(self, raw_token):
        """Return True if the token matches, is unused, and has not expired."""
        if not self.reset_token_hash or self.reset_token_used:
            return False
        if datetime.now(timezone.utc) > self.reset_token_expires.replace(tzinfo=timezone.utc):
            return False
        return self.reset_token_hash == hashlib.sha256(raw_token.encode()).hexdigest()

    def clear_reset_token(self):
        """Invalidate the reset token after use."""
        self.reset_token_hash = None
        self.reset_token_expires = None
        self.reset_token_used = True

    def __repr__(self):
        return f'<User {self.username}>'


@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))
