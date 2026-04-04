import re
from flask import Blueprint, render_template, redirect, url_for, flash, request
from flask_login import login_user, logout_user, login_required, current_user
from ..extensions import db, bcrypt
from ..models.user import User

auth_bp = Blueprint('auth', __name__)


def is_valid_email(email):
    return re.match(r'^[^@\s]+@[^@\s]+\.[^@\s]+$', email) is not None


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
            flash(f'Welcome to LA History, {username}!', 'success')
            return redirect(url_for('map.map_page'))

    return render_template('auth/register.html')


@auth_bp.route('/logout', methods=['POST'])
@login_required
def logout():
    logout_user()
    return redirect(url_for('auth.login'))
