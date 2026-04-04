import os
from flask import Flask, send_from_directory
from .config import config
from .extensions import db, login_manager, bcrypt, csrf


def create_app(config_name=None):
    if config_name is None:
        config_name = os.environ.get('FLASK_ENV', 'default')

    app = Flask(__name__, instance_relative_config=True, template_folder='../templates')
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

    # Serve the React frontend for all non-API, non-auth routes
    dist_dir = os.path.join(app.root_path, '..', 'frontend', 'dist')

    @app.route('/', defaults={'path': ''})
    @app.route('/<path:path>')
    def serve_react(path):
        full_path = os.path.join(dist_dir, path)
        if path and os.path.isfile(full_path):
            return send_from_directory(dist_dir, path)
        return send_from_directory(dist_dir, 'index.html')

    return app
