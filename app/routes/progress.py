from flask import Blueprint, jsonify, render_template, abort
from flask_login import login_required, current_user
from ..extensions import db
from ..models.location import Location
from ..models.progress import UserProgress, UserBadge
from ..services.gamification import record_visit, get_progress_summary

progress_bp = Blueprint('progress', __name__)


@progress_bp.route('/api/locations/<int:location_id>/visit', methods=['POST'])
@login_required
def visit_location(location_id):
    loc = Location.query.get_or_404(location_id)
    points_earned = record_visit(current_user.id, location_id)
    return jsonify({
        'success': True,
        'points_earned': points_earned,
        'total_points': current_user.total_points,
        'location_name': loc.name,
    })


@progress_bp.route('/api/progress')
@login_required
def get_progress():
    summary = get_progress_summary(current_user.id)
    return jsonify(summary)


@progress_bp.route('/dashboard')
@login_required
def dashboard():
    summary = get_progress_summary(current_user.id)
    return render_template('dashboard/index.html', summary=summary)


@progress_bp.route('/api/progress/reset', methods=['POST'])
@login_required
def reset_progress():
    UserProgress.query.filter_by(user_id=current_user.id).delete()
    UserBadge.query.filter_by(user_id=current_user.id).delete()
    current_user.total_points = 0
    db.session.commit()
    return jsonify({'success': True, 'message': 'All progress has been reset.'})
