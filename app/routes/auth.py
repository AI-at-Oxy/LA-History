import re
import hashlib
import secrets
from flask import Blueprint, render_template, redirect, url_for, flash, request, current_app, session
from flask_login import login_user, logout_user, login_required, current_user
from flask_mail import Message
from ..extensions import db, bcrypt, mail, limiter
from ..models.user import User

auth_bp = Blueprint('auth', __name__)


def is_valid_email(email):
    return re.match(r'^[^@\s]+@[^@\s]+\.[^@\s]+$', email) is not None


def validate_password_strength(password):
    """Return a list of strength error messages, empty if password is valid."""
    errors = []
    if len(password) < 8:
        errors.append('Password must be at least 8 characters.')
    if not re.search(r'[A-Z]', password):
        errors.append('Password must contain at least one uppercase letter.')
    if not re.search(r'[a-z]', password):
        errors.append('Password must contain at least one lowercase letter.')
    if not re.search(r'[0-9]', password):
        errors.append('Password must contain at least one digit.')
    return errors


def _build_reset_email_body(username, reset_url):
    return (
        f"Hi {username},\n\n"
        "We received a request to reset the password for your LA History account.\n\n"
        "To reset your password, click the link below (or paste it into your browser):\n\n"
        f"  {reset_url}\n\n"
        "This link expires in 1 hour and can only be used once.\n\n"
        "If you did not request a password reset, you can safely ignore this email.\n"
        "Your password has NOT been changed.\n\n"
        "— The LA History Team"
    )


@auth_bp.route('/login', methods=['GET', 'POST'])
def login():
    if current_user.is_authenticated:
        return redirect(url_for('map.map_page'))

    if request.method == 'POST':
        username = request.form.get('username', '').strip()
        password = request.form.get('password', '')
        remember = bool(request.form.get('remember'))

        # Server-side validation
        if not re.match(r'^[a-zA-Z0-9_]{3,20}$', username) or len(password) < 8:
            flash('Invalid username or password.', 'danger')
            return render_template('auth/login.html')

        user = User.query.filter_by(username=username).first()
        if user and bcrypt.check_password_hash(user.password_hash, password):
            login_user(user, remember=remember)
            next_page = request.args.get('next')
            # Prevent open-redirect: only allow relative paths
            if next_page and (next_page.startswith('/') and not next_page.startswith('//')):
                return redirect(next_page)
            return redirect(url_for('map.map_page'))

        flash('Invalid username or password.', 'danger')

    return render_template('auth/login.html')


@auth_bp.route('/register', methods=['GET', 'POST'])
def register():
    if current_user.is_authenticated:
        return redirect(url_for('map.map_page'))

    if request.method == 'POST':
        username = request.form.get('username', '').strip()
        email = request.form.get('email', '').strip().lower()
        password = request.form.get('password', '')
        confirm = request.form.get('confirm_password', '')

        errors = []
        if not re.match(r'^[a-zA-Z0-9_]{3,20}$', username):
            errors.append('Username must be 3–20 characters, letters/numbers/underscores only.')
        if not is_valid_email(email):
            errors.append('Please enter a valid email address.')
        if len(password) < 8:
            errors.append('Password must be at least 8 characters.')
        if password != confirm:
            errors.append('Passwords do not match.')
        if User.query.filter_by(username=username).first():
            errors.append('That username is already taken.')
        if User.query.filter_by(email=email).first():
            errors.append('An account with that email already exists.')

        if errors:
            for error in errors:
                flash(error, 'danger')
        else:
            password_hash = bcrypt.generate_password_hash(password).decode('utf-8')
            user = User(username=username, email=email, password_hash=password_hash)
            db.session.add(user)
            db.session.commit()
            login_user(user, remember=True)
            session['show_tutorial'] = True
            flash(f'Welcome to LA History, {username}!', 'success')
            return redirect(url_for('map.map_page'))

    return render_template('auth/register.html')


@auth_bp.route('/logout', methods=['POST'])
@login_required
def logout():
    logout_user()
    return redirect(url_for('auth.login'))


@auth_bp.route('/forgot-password', methods=['GET', 'POST'])
@limiter.limit('5 per hour')
def forgot_password():
    if current_user.is_authenticated:
        return redirect(url_for('map.map_page'))

    if request.method == 'POST':
        username = request.form.get('username', '').strip()
        email = request.form.get('email', '').strip().lower()

        # Look up user only when format is plausibly valid; always show the same message
        user = None
        if re.match(r'^[a-zA-Z0-9_]{3,20}$', username) and is_valid_email(email):
            user = User.query.filter_by(username=username, email=email).first()

        if user:
            raw_token = secrets.token_urlsafe(32)
            expiry = current_app.config.get('PASSWORD_RESET_EXPIRY_SECONDS', 3600)
            user.set_reset_token(raw_token, expiry)
            db.session.commit()

            reset_url = url_for('auth.reset_password', token=raw_token, _external=True)
            msg = Message(
                subject='Reset Your LA History Password',
                recipients=[user.email],
                body=_build_reset_email_body(user.username, reset_url),
            )
            try:
                mail.send(msg)
                current_app.logger.info('Password reset email sent to %s', user.email)
            except Exception:
                current_app.logger.error(
                    'Failed to send password reset email to %s', user.email, exc_info=True
                )
                # In debug mode, print the link to the terminal so the feature
                # can be tested without configuring a real mail server.
                if current_app.debug:
                    print(f'\n[DEBUG] Password reset link for {user.username}:\n  {reset_url}\n',
                          flush=True)

        # Always flash the same generic message regardless of outcome (anti-enumeration)
        flash(
            'If an account with that username and email exists, a reset link has been sent.',
            'info'
        )
        return redirect(url_for('auth.login'))

    return render_template('auth/forgot_password.html')


@auth_bp.route('/reset-password', methods=['GET', 'POST'])
def reset_password():
    if current_user.is_authenticated:
        return redirect(url_for('map.map_page'))

    token = ''

    if request.method == 'GET':
        token = request.args.get('token', '').strip()
    else:
        token = request.form.get('token', '').strip()

    if not token:
        flash('Invalid or expired reset link.', 'danger')
        return redirect(url_for('auth.forgot_password'))

    # Look up user by hashed token
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    user = User.query.filter_by(reset_token_hash=token_hash).first()

    if not user or not user.verify_reset_token(token):
        flash('Invalid or expired reset link.', 'danger')
        return redirect(url_for('auth.forgot_password'))

    if request.method == 'POST':
        new_password = request.form.get('new_password', '')
        confirm_password = request.form.get('confirm_password', '')

        errors = validate_password_strength(new_password)
        if new_password != confirm_password:
            errors.append('Passwords do not match.')

        if errors:
            for error in errors:
                flash(error, 'danger')
            return render_template('auth/reset_password.html', token=token)

        # Invalidate token first, then update password
        user.clear_reset_token()
        user.password_hash = bcrypt.generate_password_hash(new_password).decode('utf-8')
        db.session.commit()

        flash('Your password has been reset. Please sign in.', 'success')
        return redirect(url_for('auth.login'))

    return render_template('auth/reset_password.html', token=token)
