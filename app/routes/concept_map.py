import json
from datetime import datetime
from flask import Blueprint, jsonify, request
from flask_login import login_required, current_user
from ..extensions import db
from ..models.concept_map import ConceptMap
from ..models.location import Location
from ..models.progress import UserProgress
from ..models.user import User
from ..services.gamification import (
    award_points, check_and_award_badges,
    POINTS_CONCEPT_MAP_SUBMIT, POINTS_CONCEPT_MAP_BONUS,
)
from ..services.ollama_service import evaluate_concept_map

concept_map_bp = Blueprint('concept_map', __name__)


def _get_era_data(era_order, user_id):
    """Return (locations, user_progress_map, era_name) for an era."""
    locations = Location.query.filter_by(era_order=era_order).order_by(Location.id).all()
    user_progress = {
        p.location_id: p
        for p in UserProgress.query.filter_by(user_id=user_id).all()
    }
    return locations, user_progress


def _minimal_graph(graph_json_str):
    """Strip cytoscape metadata — send only human-readable fields to Ollama."""
    try:
        g = json.loads(graph_json_str)
    except (json.JSONDecodeError, TypeError):
        return graph_json_str
    els = g.get('elements', {})
    # cy.json() elements may be a dict {nodes:[...], edges:[...]} or a flat list
    if isinstance(els, dict):
        raw_nodes = els.get('nodes', [])
        raw_edges = els.get('edges', [])
    else:
        raw_nodes = [e for e in els if e.get('group') == 'nodes']
        raw_edges = [e for e in els if e.get('group') == 'edges']
    nodes = [{'id': n['data'].get('id'), 'label': n['data'].get('label')} for n in raw_nodes]
    edges = [
        {
            'source': e['data'].get('source'),
            'target': e['data'].get('target'),
            'label': e['data'].get('label', ''),
        }
        for e in raw_edges
    ]
    return json.dumps({'nodes': nodes, 'edges': edges})


def _count_edges(graph_json_str):
    """Count edges in a stored cy.json() string."""
    try:
        g = json.loads(graph_json_str)
    except (json.JSONDecodeError, TypeError):
        return 0
    els = g.get('elements', {})
    if isinstance(els, dict):
        return len(els.get('edges', []))
    return sum(1 for e in els if e.get('group') == 'edges')


@concept_map_bp.route('/api/concept_map/<int:era_order>')
@login_required
def get_concept_map(era_order):
    locations, user_progress = _get_era_data(era_order, current_user.id)
    if not locations:
        return jsonify({'error': 'Era not found.'}), 404

    location_data = [
        {
            'id': loc.id,
            'name': loc.name,
            'era': loc.era,
            'era_order': loc.era_order,
            'short_description': loc.short_description,
            'visited': bool(user_progress.get(loc.id) and user_progress[loc.id].visited),
            'quiz_passed': bool(user_progress.get(loc.id) and user_progress[loc.id].quiz_passed),
        }
        for loc in locations
    ]

    era_quizzes_all_passed = all(l['quiz_passed'] for l in location_data)

    concept_map = ConceptMap.query.filter_by(
        user_id=current_user.id, era_order=era_order
    ).first()

    return jsonify({
        'era_order': era_order,
        'era_name': locations[0].era,
        'locations': location_data,
        'era_quizzes_all_passed': era_quizzes_all_passed,
        'concept_map': concept_map.to_dict() if concept_map else None,
    })


@concept_map_bp.route('/api/concept_map/<int:era_order>/save', methods=['POST'])
@login_required
def save_concept_map(era_order):
    data = request.get_json()
    if not data or 'graph_json' not in data:
        return jsonify({'error': 'graph_json is required.'}), 400

    # Accept either a dict (raw cy.json()) or a pre-serialised string
    gj = data['graph_json']
    graph_json_str = json.dumps(gj) if isinstance(gj, (dict, list)) else gj

    concept_map = ConceptMap.query.filter_by(
        user_id=current_user.id, era_order=era_order
    ).first()

    if not concept_map:
        concept_map = ConceptMap(user_id=current_user.id, era_order=era_order)
        db.session.add(concept_map)

    if concept_map.submitted:
        return jsonify({'error': 'This map has already been submitted and cannot be edited.'}), 403

    concept_map.graph_json = graph_json_str
    concept_map.updated_at = datetime.utcnow()
    db.session.commit()

    return jsonify({'success': True, 'updated_at': concept_map.updated_at.isoformat()})


@concept_map_bp.route('/api/concept_map/<int:era_order>/evaluate', methods=['POST'])
@login_required
def evaluate_map(era_order):
    locations, user_progress = _get_era_data(era_order, current_user.id)
    if not locations:
        return jsonify({'error': 'Era not found.'}), 404

    # Server-side gate: all era quizzes must be passed
    if not all(
        user_progress.get(loc.id) and user_progress[loc.id].quiz_passed
        for loc in locations
    ):
        return jsonify({'error': 'Complete all era quizzes before submitting your concept map.'}), 403

    concept_map = ConceptMap.query.filter_by(
        user_id=current_user.id, era_order=era_order
    ).first()

    if not concept_map or not concept_map.graph_json:
        return jsonify({'error': 'No saved map found. Please save first.'}), 400

    # Idempotent — return stored feedback if already submitted
    if concept_map.submitted:
        return jsonify({
            'already_submitted': True,
            'ai_feedback': json.loads(concept_map.ai_feedback) if concept_map.ai_feedback else {},
            'points_earned': concept_map.points_earned,
        })

    if _count_edges(concept_map.graph_json) < 3:
        return jsonify({'error': 'You need at least 3 connections before submitting.'}), 400

    era_name = locations[0].era.capitalize()
    locations_context = '\n'.join(
        f'- {loc.name}: {loc.short_description}' for loc in locations
    )

    feedback, error = evaluate_concept_map(era_name, locations_context, concept_map.graph_json)
    if error:
        return jsonify({'error': error}), 503

    pts = POINTS_CONCEPT_MAP_SUBMIT
    if feedback.get('synthesis_score', 0) >= 80:
        pts += POINTS_CONCEPT_MAP_BONUS

    user = current_user._get_current_object()
    award_points(user, pts)

    concept_map.submitted = True
    concept_map.ai_feedback = json.dumps(feedback)
    concept_map.points_earned = pts
    concept_map.updated_at = datetime.utcnow()
    db.session.flush()

    new_badges = check_and_award_badges(user)  # commits internally

    return jsonify({
        'success': True,
        'ai_feedback': feedback,
        'points_earned': pts,
        'total_points': user.total_points,
        'new_badges': new_badges,
        'synthesis_score': feedback.get('synthesis_score', 0),
    })
