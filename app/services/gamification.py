from datetime import datetime
from ..extensions import db
from ..models.location import Location
from ..models.progress import UserProgress, Badge, UserBadge
from ..models.user import User


# Points awarded for each action
POINTS_VISIT = 10
POINTS_QUIZ_PASS_FIRST = 50
POINTS_QUIZ_PASS_RETRY = 25
POINTS_QUIZ_BONUS_90 = 20
POINTS_ERA_COMPLETE = 100


def get_or_create_progress(user_id, location_id):
    progress = UserProgress.query.filter_by(
        user_id=user_id, location_id=location_id
    ).first()
    if not progress:
        progress = UserProgress(user_id=user_id, location_id=location_id)
        db.session.add(progress)
        db.session.flush()
    return progress


def award_points(user, points):
    user.total_points = (user.total_points or 0) + points
    db.session.flush()


def record_visit(user_id, location_id):
    """Mark a location visited and award points if first visit. Returns points earned."""
    progress = get_or_create_progress(user_id, location_id)
    if progress.visited:
        return 0

    progress.visited = True
    progress.visited_at = datetime.utcnow()
    progress.points_earned = (progress.points_earned or 0) + POINTS_VISIT

    user = User.query.get(user_id)
    award_points(user, POINTS_VISIT)
    db.session.commit()

    check_and_award_badges(user)
    return POINTS_VISIT


def record_quiz_result(user_id, location_id, score_percent, quiz_points_reward):
    """
    Record a quiz attempt. Awards points based on first/retry pass.
    Returns dict with points_earned and newly_unlocked location ids.
    """
    progress = get_or_create_progress(user_id, location_id)
    user = User.query.get(user_id)

    passed = score_percent >= 70
    is_first_attempt = progress.quiz_attempts == 0
    already_passed = progress.quiz_passed

    progress.quiz_attempts = (progress.quiz_attempts or 0) + 1
    if progress.quiz_score is None or score_percent > progress.quiz_score:
        progress.quiz_score = score_percent

    points_earned = 0
    if passed and not already_passed:
        progress.quiz_passed = True
        if is_first_attempt:
            points_earned += quiz_points_reward
        else:
            points_earned += quiz_points_reward // 2

        if score_percent >= 90:
            points_earned += POINTS_QUIZ_BONUS_90

        progress.points_earned = (progress.points_earned or 0) + points_earned
        award_points(user, points_earned)

    db.session.commit()

    newly_unlocked = check_era_unlocks(user_id)
    check_and_award_badges(user)

    return {
        'passed': passed,
        'points_earned': points_earned,
        'newly_unlocked': newly_unlocked,
    }


def check_era_unlocks(user_id):
    """
    Check whether the user's progress unlocks any new eras.
    Returns a list of location ids that are newly accessible.
    """
    all_locations = Location.query.order_by(Location.era_order).all()
    user_progress = {
        p.location_id: p
        for p in UserProgress.query.filter_by(user_id=user_id).all()
    }

    # Group locations by era_order
    eras = {}
    for loc in all_locations:
        eras.setdefault(loc.era_order, []).append(loc)

    newly_unlocked = []

    for era_order in sorted(eras.keys()):
        if era_order == 1:
            continue  # Era 1 is always unlocked (is_starter)

        prev_era_locs = eras.get(era_order - 1, [])
        if not prev_era_locs:
            continue

        prev_passed = sum(
            1 for loc in prev_era_locs
            if user_progress.get(loc.id) and user_progress[loc.id].quiz_passed
        )
        prev_total = len(prev_era_locs)

        # Era 2: unlock when 50% of era 1 passed
        # Era 3+: unlock when 100% of previous era passed
        if era_order == 2:
            threshold_met = prev_passed >= (prev_total * 0.5)
        else:
            threshold_met = prev_passed == prev_total

        if threshold_met:
            for loc in eras[era_order]:
                prog = user_progress.get(loc.id)
                # If they haven't visited yet, this location is "newly accessible"
                if not prog or not prog.visited:
                    newly_unlocked.append(loc.id)

    return newly_unlocked


def is_location_unlocked(user_id, location):
    """Return True if the given location is accessible to this user."""
    if location.is_starter:
        return True

    all_locations = Location.query.order_by(Location.era_order).all()
    user_progress = {
        p.location_id: p
        for p in UserProgress.query.filter_by(user_id=user_id).all()
    }

    eras = {}
    for loc in all_locations:
        eras.setdefault(loc.era_order, []).append(loc)

    prev_era_locs = eras.get(location.era_order - 1, [])
    if not prev_era_locs:
        return True

    prev_passed = sum(
        1 for loc in prev_era_locs
        if user_progress.get(loc.id) and user_progress[loc.id].quiz_passed
    )
    prev_total = len(prev_era_locs)

    if location.era_order == 2:
        return prev_passed >= (prev_total * 0.5)
    return prev_passed == prev_total


def check_and_award_badges(user):
    """Check all badge conditions and award any newly earned badges."""
    user_id = user.id
    earned_slugs = {
        ub.badge.slug for ub in UserBadge.query.filter_by(user_id=user_id).all()
    }

    all_progress = UserProgress.query.filter_by(user_id=user_id).all()
    visited_count = sum(1 for p in all_progress if p.visited)
    total_locations = Location.query.count()

    # Group by era
    era_locations = {}
    for loc in Location.query.all():
        era_locations.setdefault(loc.era_order, []).append(loc.id)

    progress_map = {p.location_id: p for p in all_progress}

    def era_all_passed(era_order):
        locs = era_locations.get(era_order, [])
        return locs and all(
            progress_map.get(lid) and progress_map[lid].quiz_passed
            for lid in locs
        )

    candidates = []

    if visited_count >= 1:
        candidates.append('first_steps')
    if visited_count >= 5:
        candidates.append('explorer')
    if visited_count >= total_locations:
        candidates.append('historian')
    if (user.total_points or 0) >= 500:
        candidates.append('century_seeker')
    if era_all_passed(1):
        candidates.append('native_scholar')
    if era_all_passed(2):
        candidates.append('spanish_era_complete')
    if era_all_passed(3):
        candidates.append('rancho_era_complete')
    if era_all_passed(4):
        candidates.append('modern_era_complete')

    new_badges = []
    for slug in candidates:
        if slug not in earned_slugs:
            badge = Badge.query.filter_by(slug=slug).first()
            if badge:
                db.session.add(UserBadge(user_id=user_id, badge_id=badge.id))
                new_badges.append(badge.to_dict())

    if new_badges:
        db.session.commit()

    return new_badges


def get_progress_summary(user_id):
    """Return a full progress summary dict for the dashboard and API."""
    user = User.query.get(user_id)
    all_locations = Location.query.order_by(Location.era_order, Location.id).all()
    all_progress = {
        p.location_id: p
        for p in UserProgress.query.filter_by(user_id=user_id).all()
    }

    eras = {}
    for loc in all_locations:
        key = loc.era_order
        if key not in eras:
            eras[key] = {'era': loc.era, 'era_order': key, 'locations': [], 'visited': 0, 'passed': 0, 'total': 0}
        prog = all_progress.get(loc.id)
        unlocked = is_location_unlocked(user_id, loc)
        eras[key]['locations'].append({
            'id': loc.id,
            'name': loc.name,
            'slug': loc.slug,
            'unlocked': unlocked,
            'visited': prog.visited if prog else False,
            'quiz_passed': prog.quiz_passed if prog else False,
            'quiz_score': prog.quiz_score if prog else None,
            'points_earned': prog.points_earned if prog else 0,
        })
        eras[key]['total'] += 1
        if prog and prog.visited:
            eras[key]['visited'] += 1
        if prog and prog.quiz_passed:
            eras[key]['passed'] += 1

    badges = [
        {**ub.badge.to_dict(), 'earned_at': ub.earned_at.isoformat()}
        for ub in UserBadge.query.filter_by(user_id=user_id).all()
    ]

    return {
        'user': {
            'id': user.id,
            'username': user.username,
            'total_points': user.total_points or 0,
        },
        'eras': list(eras.values()),
        'badges': badges,
        'total_visited': sum(1 for p in all_progress.values() if p.visited),
        'total_passed': sum(1 for p in all_progress.values() if p.quiz_passed),
        'total_locations': len(all_locations),
    }
