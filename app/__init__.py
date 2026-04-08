import os
from flask import Flask, redirect, url_for
from .config import config
from .extensions import db, login_manager, bcrypt, csrf


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

    login_manager.login_view = 'auth.login'
    login_manager.login_message = 'Please log in to access this page.'
    login_manager.login_message_category = 'info'

    # Register blueprints
    from .routes.auth import auth_bp
    from .routes.map import map_bp
    from .routes.progress import progress_bp
    from .routes.quiz import quiz_bp
    from .routes.chat import chat_bp

    app.register_blueprint(auth_bp)
    app.register_blueprint(map_bp)
    app.register_blueprint(progress_bp)
    app.register_blueprint(quiz_bp)
    app.register_blueprint(chat_bp)

    # Create tables
    with app.app_context():
        db.create_all()
        # Add image_caption column if it doesn't exist (for existing databases)
        with db.engine.connect() as conn:
            from sqlalchemy import text, inspect
            inspector = inspect(db.engine)
            cols = [c['name'] for c in inspector.get_columns('locations')]
            if 'image_caption' not in cols:
                conn.execute(text('ALTER TABLE locations ADD COLUMN image_caption VARCHAR(500)'))
                conn.commit()

    @app.route('/')
    def index():
        return redirect(url_for('map.map_page'))

    return app
