from flask import Blueprint, jsonify, request, abort
from flask_login import login_required, current_user
from ..extensions import db
from ..models.location import Location
from ..models.quiz import Quiz, QuizQuestion
from ..models.progress import UserProgress
from ..services.gamification import (
    is_location_unlocked, record_quiz_result, spend_points, POINTS_HINT
)

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


@quiz_bp.route('/api/quiz/<int:location_id>/hint', methods=['POST'])
@login_required
def get_quiz_hint(location_id):
    loc = Location.query.get_or_404(location_id)

    if not is_location_unlocked(current_user.id, loc):
        return jsonify({'error': 'This location is not yet unlocked.'}), 403

    # Hints unavailable for already-passed quizzes
    progress = UserProgress.query.filter_by(
        user_id=current_user.id, location_id=location_id
    ).first()
    if progress and progress.quiz_passed:
        return jsonify({'error': 'Quiz already passed — hints are unavailable.'}), 403

    data = request.get_json()
    if not data or 'question_id' not in data:
        return jsonify({'error': 'question_id is required.'}), 400

    question = QuizQuestion.query.get(data['question_id'])
    if not question or question.quiz.location_id != location_id:
        return jsonify({'error': 'Question not found.'}), 404

    user = current_user._get_current_object()
    ok, err = spend_points(user, POINTS_HINT)
    if not ok:
        return jsonify({'error': err}), 402

    from ..services.ollama_service import get_quiz_hint as ollama_hint
    hint, ollama_err = ollama_hint(question, loc)
    if ollama_err:
        # Refund points on Ollama failure
        user.total_points = (user.total_points or 0) + POINTS_HINT
        db.session.commit()
        return jsonify({'error': ollama_err}), 503

    db.session.commit()
    return jsonify({'hint': hint, 'total_points': user.total_points})


@quiz_bp.route('/api/quiz/check_answer', methods=['POST'])
@login_required
def check_answer():
    data = request.get_json()
    if not data or 'question_id' not in data or 'chosen_answer' not in data:
        return jsonify({'error': 'question_id and chosen_answer are required.'}), 400

    q = QuizQuestion.query.get_or_404(int(data['question_id']))
    chosen = str(data['chosen_answer']).strip().lower()
    is_correct = (chosen == q.correct_answer.lower())

    if is_correct:
        return jsonify({'is_correct': True, 'explanation': q.explanation or ''})

    # Wrong answer: look up the per-option explanation authored for this choice.
    # Do NOT return q.explanation here — it's written from the correct-answer perspective.
    wrong_explanation = getattr(q, f'wrong_explanation_{chosen}', None)
    if not wrong_explanation:
        wrong_explanation = (
            "That's not quite right. "
            "This answer doesn't accurately reflect the historical record — "
            "try reviewing what you know about this topic."
        )
    return jsonify({'is_correct': False, 'explanation': wrong_explanation})


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

    # Sanitize hints_used: cap at number of questions to prevent exploitation
    hints_used = min(int(data.get('hints_used', 0)), len(questions))

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
        current_user.id, location_id, score_percent, quiz.points_reward, hints_used=hints_used
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
