import os
from flask import Flask, redirect, url_for
from .config import config
from .extensions import db, login_manager, bcrypt, csrf, mail, limiter


def create_app(config_name=None):
    if config_name is None:
        config_name = os.environ.get('FLASK_ENV', 'default')

    app = Flask(__name__, instance_relative_config=True, template_folder='../templates', static_folder='../static')
    app.config.from_object(config[config_name])

    # Ensure instance folder exists
    os.makedirs(app.instance_path, exist_ok=True)

    # Initialize extensions
    db.init_app(app)
    login_manager.init_app(app)
    bcrypt.init_app(app)
    csrf.init_app(app)
    mail.init_app(app)
    limiter.init_app(app)

    login_manager.login_view = 'auth.login'
    login_manager.login_message = 'Please log in to access this page.'
    login_manager.login_message_category = 'info'

    # Register blueprints
    from .routes.auth import auth_bp
    from .routes.map import map_bp
    from .routes.progress import progress_bp
    from .routes.quiz import quiz_bp
    from .routes.chat import chat_bp
    from .routes.concept_map import concept_map_bp
    from .routes.memory_challenge import memory_challenge_bp
    app.register_blueprint(auth_bp)
    app.register_blueprint(map_bp)
    app.register_blueprint(progress_bp)
    app.register_blueprint(quiz_bp)
    app.register_blueprint(chat_bp)
    app.register_blueprint(concept_map_bp)
    app.register_blueprint(memory_challenge_bp)

    # SQLite concurrency: enable WAL + a generous busy_timeout so concurrent
    # requests don't immediately hit "database is locked" when one holds a write.
    from sqlalchemy import event
    from sqlalchemy.engine import Engine

    @event.listens_for(Engine, 'connect')
    def _sqlite_pragmas(dbapi_conn, _):
        try:
            cur = dbapi_conn.cursor()
            cur.execute('PRAGMA journal_mode=WAL')
            cur.execute('PRAGMA busy_timeout=10000')
            cur.close()
        except Exception:
            pass

    # Create tables
    with app.app_context():
        db.create_all()
        # Add image_caption column if it doesn't exist (for existing databases)
        with db.engine.connect() as conn:
            from sqlalchemy import text, inspect
            from sqlalchemy.exc import OperationalError
            inspector = inspect(db.engine)
            cols = [c['name'] for c in inspector.get_columns('locations')]
            if 'image_caption' not in cols:
                conn.execute(text('ALTER TABLE locations ADD COLUMN image_caption VARCHAR(500)'))
                conn.commit()
            for col, ddl in [
                ('video_url',     'ALTER TABLE locations ADD COLUMN video_url VARCHAR(500)'),
                ('video_caption', 'ALTER TABLE locations ADD COLUMN video_caption VARCHAR(500)'),
            ]:
                if col not in cols:
                    try:
                        conn.execute(text(ddl))
                        conn.commit()
                    except OperationalError:
                        pass
            # Password reset token columns
            user_cols = [c['name'] for c in inspector.get_columns('users')]
            for col, ddl in [
                ('reset_token_hash',    'ALTER TABLE users ADD COLUMN reset_token_hash VARCHAR(64)'),
                ('reset_token_expires', 'ALTER TABLE users ADD COLUMN reset_token_expires DATETIME'),
                ('reset_token_used',    'ALTER TABLE users ADD COLUMN reset_token_used BOOLEAN DEFAULT 0'),
            ]:
                if col not in user_cols:
                    try:
                        conn.execute(text(ddl))
                        conn.commit()
                    except OperationalError:
                        pass  # Column already exists (concurrent startup)
            # Concept-map chat session era column
            chat_cols = [c['name'] for c in inspector.get_columns('chat_sessions')]
            if 'era_order' not in chat_cols:
                try:
                    conn.execute(text('ALTER TABLE chat_sessions ADD COLUMN era_order INTEGER'))
                    conn.commit()
                except OperationalError:
                    pass
            # Concept-map insight tokens column
            cm_cols = [c['name'] for c in inspector.get_columns('concept_maps')]
            if 'insight_uses' not in cm_cols:
                try:
                    conn.execute(text('ALTER TABLE concept_maps ADD COLUMN insight_uses INTEGER DEFAULT 3'))
                    conn.commit()
                except OperationalError:
                    pass
            # Memory challenge AI-generated questions column
            try:
                mc_cols = [c['name'] for c in inspector.get_columns('memory_challenge_attempts')]
                if 'generated_questions' not in mc_cols:
                    conn.execute(text('ALTER TABLE memory_challenge_attempts ADD COLUMN generated_questions TEXT'))
                    conn.commit()
            except Exception:
                pass
            # Quiz hint cache column
            try:
                qq_cols = [c['name'] for c in inspector.get_columns('quiz_questions')]
                if 'hint_cache' not in qq_cols:
                    conn.execute(text('ALTER TABLE quiz_questions ADD COLUMN hint_cache TEXT'))
                    conn.commit()
            except Exception:
                pass

    @app.route('/')
    def index():
        return redirect(url_for('map.map_page'))

    return app
