from flask import Blueprint, render_template, jsonify, abort, session
from flask_login import login_required, current_user
from ..models.location import Location
from ..models.progress import UserProgress
from ..services.gamification import is_location_unlocked

map_bp = Blueprint('map', __name__)


@map_bp.route('/map')
@login_required
def map_page():
    show_tutorial = session.pop('show_tutorial', False)
    return render_template('map/index.html', show_tutorial=show_tutorial)


@map_bp.route('/api/locations')
@login_required
def get_locations():
    locations = Location.query.order_by(Location.era_order, Location.id).all()
    user_progress = {
        p.location_id: p
        for p in UserProgress.query.filter_by(user_id=current_user.id).all()
    }

    result = []
    for loc in locations:
        prog = user_progress.get(loc.id)
        data = loc.to_dict(user_progress=prog)
        data['unlocked'] = is_location_unlocked(current_user.id, loc)
        result.append(data)

    return jsonify(result)


@map_bp.route('/api/locations/<int:location_id>')
@login_required
def get_location(location_id):
    loc = Location.query.get_or_404(location_id)
    unlocked = is_location_unlocked(current_user.id, loc)

    prog = UserProgress.query.filter_by(
        user_id=current_user.id, location_id=location_id
    ).first()

    data = loc.to_dict(user_progress=prog)
    data['unlocked'] = unlocked
    data['full_description'] = loc.full_description
    data['events'] = [e.to_dict() for e in loc.events]
    data['has_quiz'] = loc.quiz is not None
    data['quiz_attempts'] = prog.quiz_attempts if prog else 0
    if loc.quiz:
        data['quiz_passing_score'] = loc.quiz.passing_score
        data['quiz_points_reward'] = loc.quiz.points_reward

    return jsonify(data)
