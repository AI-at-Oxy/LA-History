import json
import random
from flask import Blueprint, jsonify, request
from flask_login import login_required, current_user
from ..extensions import db
from ..models.location import Location
from ..models.quiz import Quiz, QuizQuestion
from ..models.concept_map import MemoryChallengeAttempt
from ..services.gamification import (
    spend_points, award_points, check_and_award_badges,
    is_era_complete_for_challenge,
    POINTS_MEMORY_CHALLENGE_COST, POINTS_MEMORY_CHALLENGE_REWARD, MEMORY_CHALLENGE_THRESHOLD,
)
from ..services.ollama_service import generate_memory_challenge_questions

ERA_NAMES = {1: 'Native', 2: 'Spanish', 3: 'Rancho', 4: 'Modern'}

memory_challenge_bp = Blueprint('memory_challenge', __name__)


@memory_challenge_bp.route('/api/memory_challenge/<int:era_order>/start', methods=['POST'])
@login_required
def start_challenge(era_order):
    if not is_era_complete_for_challenge(current_user.id, era_order):
        return jsonify({'error': 'Complete all era quizzes and submit the concept map first.'}), 403

    attempt = MemoryChallengeAttempt.query.filter_by(
        user_id=current_user.id, era_order=era_order
    ).first()
    if attempt and attempt.attempted:
        return jsonify({'error': 'You have already attempted this Memory Challenge.'}), 403

    user = current_user._get_current_object()
    ok, err = spend_points(user, POINTS_MEMORY_CHALLENGE_COST)
    if not ok:
        return jsonify({'error': err}), 402

    # Reserve the attempt row and commit BEFORE the slow Ollama call so we
    # don't hold SQLite's write lock for the duration of AI generation.
    if not attempt:
        attempt = MemoryChallengeAttempt(user_id=current_user.id, era_order=era_order)
        db.session.add(attempt)
    attempt.attempted = True
    db.session.commit()

    # Gather era locations and build context for AI generation
    era_locs = Location.query.filter_by(era_order=era_order).all()
    era_name = ERA_NAMES.get(era_order, f'Era {era_order}')

    # Build a concise context block: name + first 180 chars of description per location
    context_lines = []
    for loc in era_locs:
        desc = (loc.full_description or '').strip()
        snippet = desc[:180] + ('...' if len(desc) > 180 else '')
        context_lines.append(f'- {loc.name}: {snippet}')
    locations_context = '\n'.join(context_lines)

    # Try AI generation first; fall back to sampling existing quiz questions
    ai_questions, ai_err = generate_memory_challenge_questions(era_name, locations_context, count=8)

    if ai_questions:
        # Store full question data (including answers) server-side for grading
        attempt.generated_questions = json.dumps(ai_questions)
        attempt.question_ids = None
        db.session.commit()

        # Strip correct_answer and explanation before sending to client
        client_questions = [
            {k: v for k, v in q.items() if k not in ('correct_answer', 'explanation')}
            for q in ai_questions
        ]
    else:
        # Fallback: sample from existing quiz questions
        all_questions = []
        for loc in era_locs:
            quiz = Quiz.query.filter_by(location_id=loc.id).first()
            if quiz:
                all_questions.extend(list(quiz.questions))

        sample_size = min(8, len(all_questions))
        sampled = random.sample(all_questions, sample_size)
        attempt.question_ids = json.dumps([q.id for q in sampled])
        attempt.generated_questions = None
        db.session.commit()

        client_questions = [q.to_dict(include_answers=False) for q in sampled]

    return jsonify({
        'era_order': era_order,
        'questions': client_questions,
        'threshold': MEMORY_CHALLENGE_THRESHOLD,
        'reward': POINTS_MEMORY_CHALLENGE_REWARD,
        'total_points': user.total_points,
    })


@memory_challenge_bp.route('/api/memory_challenge/<int:era_order>/submit', methods=['POST'])
@login_required
def submit_challenge(era_order):
    attempt = MemoryChallengeAttempt.query.filter_by(
        user_id=current_user.id, era_order=era_order
    ).first()

    if not attempt or not attempt.attempted:
        return jsonify({'error': 'No active challenge found.'}), 400

    if attempt.score_pct is not None:
        return jsonify({'error': 'Challenge already graded.'}), 400

    data = request.get_json() or {}
    answers = data.get('answers', {})  # {question_id_str: answer_char}

    correct_count = 0
    results = []

    if attempt.generated_questions:
        # AI-generated questions path — grade against stored question data
        gen_qs = json.loads(attempt.generated_questions)
        for q in gen_qs:
            submitted = str(answers.get(str(q['id']), '')).lower().strip()
            is_correct = submitted == q['correct_answer'].lower()
            if is_correct:
                correct_count += 1
            results.append({
                'question_id': q['id'],
                'question_text': q['question_text'],
                'submitted': submitted,
                'correct_answer': q['correct_answer'],
                'is_correct': is_correct,
                'explanation': q.get('explanation', ''),
            })
        total_questions = len(gen_qs)
    else:
        # Fallback path — load question IDs from DB
        if not attempt.question_ids:
            return jsonify({'error': 'Challenge data missing. Please contact support.'}), 500
        qids = json.loads(attempt.question_ids)
        questions = QuizQuestion.query.filter(QuizQuestion.id.in_(qids)).all()
        if not questions:
            return jsonify({'error': 'Questions not found.'}), 500
        for q in questions:
            submitted = str(answers.get(str(q.id), '')).lower().strip()
            is_correct = submitted == q.correct_answer.lower()
            if is_correct:
                correct_count += 1
            results.append({
                'question_id': q.id,
                'question_text': q.question_text,
                'submitted': submitted,
                'correct_answer': q.correct_answer,
                'is_correct': is_correct,
                'explanation': q.explanation,
            })
        total_questions = len(questions)

    score_pct = round((correct_count / total_questions) * 100)
    passed = score_pct >= MEMORY_CHALLENGE_THRESHOLD

    attempt.passed = passed
    attempt.score_pct = score_pct

    user = current_user._get_current_object()
    points_earned = 0
    if passed:
        award_points(user, POINTS_MEMORY_CHALLENGE_REWARD)
        points_earned = POINTS_MEMORY_CHALLENGE_REWARD

    db.session.commit()
    new_badges = check_and_award_badges(user)

    return jsonify({
        'passed': passed,
        'score_pct': score_pct,
        'correct_count': correct_count,
        'total_questions': total_questions,
        'points_earned': points_earned,
        'total_points': user.total_points,
        'new_badges': new_badges,
        'results': results,
    })
