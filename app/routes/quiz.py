from flask import Blueprint, jsonify, request, abort
from flask_login import login_required, current_user
from ..models.location import Location
from ..models.quiz import Quiz
from ..services.gamification import is_location_unlocked, record_quiz_result

quiz_bp = Blueprint('quiz', __name__)


@quiz_bp.route('/api/quiz/<int:location_id>')
@login_required
def get_quiz(location_id):
    loc = Location.query.get_or_404(location_id)

    if not is_location_unlocked(current_user.id, loc):
        return jsonify({'error': 'This location is not yet unlocked.'}), 403

    quiz = Quiz.query.filter_by(location_id=location_id).first()
    if not quiz:
        return jsonify({'error': 'No quiz available for this location.'}), 404

    return jsonify(quiz.to_dict(include_answers=False))


@quiz_bp.route('/api/quiz/<int:location_id>/submit', methods=['POST'])
@login_required
def submit_quiz(location_id):
    loc = Location.query.get_or_404(location_id)

    if not is_location_unlocked(current_user.id, loc):
        return jsonify({'error': 'This location is not yet unlocked.'}), 403

    quiz = Quiz.query.filter_by(location_id=location_id).first()
    if not quiz:
        return jsonify({'error': 'No quiz found.'}), 404

    data = request.get_json()
    if not data or 'answers' not in data:
        return jsonify({'error': 'No answers provided.'}), 400

    answers = data['answers']  # {question_id: answer_char}
    questions = list(quiz.questions)

    if not questions:
        return jsonify({'error': 'Quiz has no questions.'}), 500

    results = []
    correct_count = 0

    for question in questions:
        submitted = str(answers.get(str(question.id), '')).lower().strip()
        is_correct = submitted == question.correct_answer.lower()
        if is_correct:
            correct_count += 1
        results.append({
            'question_id': question.id,
            'question_text': question.question_text,
            'submitted': submitted,
            'correct_answer': question.correct_answer,
            'is_correct': is_correct,
            'explanation': question.explanation,
        })

    score_percent = round((correct_count / len(questions)) * 100)

    outcome = record_quiz_result(
        current_user.id, location_id, score_percent, quiz.points_reward
    )

    return jsonify({
        'score_percent': score_percent,
        'correct_count': correct_count,
        'total_questions': len(questions),
        'passed': outcome['passed'],
        'points_earned': outcome['points_earned'],
        'total_points': current_user.total_points,
        'newly_unlocked': outcome['newly_unlocked'],
        'new_badges': outcome['new_badges'],
        'results': results,
    })
