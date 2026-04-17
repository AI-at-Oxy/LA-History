import json
from flask import Blueprint, jsonify, render_template, abort
from flask_login import login_required, current_user
from ..extensions import db
from ..models.location import Location
from ..models.progress import UserProgress, UserBadge
from ..models.concept_map import ConceptMap, MemoryChallengeAttempt
from ..services.gamification import record_visit, get_progress_summary


def _parse_cm_for_dashboard(cm):
    """Return graph stats and AI score for a ConceptMap row."""
    result = {
        'era_order':     cm.era_order,
        'submitted':     cm.submitted,
        'points_earned': cm.points_earned,
        'updated_at':    cm.updated_at.isoformat() if cm.updated_at else None,
        'node_count':    0,
        'edge_count':    0,
        'node_labels':   [],
        'edge_pairs':    [],
        'synthesis_score': None,
    }
    if cm.graph_json:
        try:
            g = json.loads(cm.graph_json)
            els = g.get('elements', {})
            nodes = els.get('nodes', []) if isinstance(els, dict) else [e for e in els if e.get('group') == 'nodes']
            edges = els.get('edges', []) if isinstance(els, dict) else [e for e in els if e.get('group') == 'edges']
            result['node_count'] = len(nodes)
            result['edge_count'] = len(edges)
            # Take up to 12 nodes for the mini-preview
            preview_nodes = [n for n in nodes if n.get('data', {}).get('label')][:12]
            result['node_labels'] = [n['data']['label'] for n in preview_nodes]
            # Build id→index map for edge lookup
            id_to_idx = {n['data']['id']: i for i, n in enumerate(preview_nodes)}
            # Extract edges between preview nodes (up to 24)
            pairs = []
            for e in edges:
                s = e.get('data', {}).get('source')
                t = e.get('data', {}).get('target')
                if s in id_to_idx and t in id_to_idx:
                    pairs.append([id_to_idx[s], id_to_idx[t]])
                if len(pairs) >= 24:
                    break
            result['edge_pairs'] = pairs
        except Exception:
            pass
    if cm.ai_feedback:
        try:
            result['synthesis_score'] = json.loads(cm.ai_feedback).get('synthesis_score')
        except Exception:
            pass
    return result

progress_bp = Blueprint('progress', __name__)


@progress_bp.route('/api/locations/<int:location_id>/visit', methods=['POST'])
@login_required
def visit_location(location_id):
    loc = Location.query.get_or_404(location_id)
    result = record_visit(current_user.id, location_id)
    return jsonify({
        'success': True,
        'points_earned': result['points_earned'],
        'total_points': current_user.total_points,
        'location_name': loc.name,
        'new_badges': result['new_badges'],
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
    raw_cms = ConceptMap.query.filter_by(user_id=current_user.id).all()
    concept_maps = {cm.era_order: _parse_cm_for_dashboard(cm) for cm in raw_cms}
    return render_template('dashboard/index.html', summary=summary, concept_maps=concept_maps)


@progress_bp.route('/api/progress/reset', methods=['POST'])
@login_required
def reset_progress():
    UserProgress.query.filter_by(user_id=current_user.id).delete()
    UserBadge.query.filter_by(user_id=current_user.id).delete()
    ConceptMap.query.filter_by(user_id=current_user.id).delete()
    MemoryChallengeAttempt.query.filter_by(user_id=current_user.id).delete()
    current_user.total_points = 0
    db.session.commit()
    return jsonify({'success': True, 'message': 'All progress has been reset.'})
