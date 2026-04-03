"""
Populate the database with seed data from data/locations.json and data/quizzes.json.
Run with: python seed_db.py
"""
import json
import os
from app import create_app
from app.extensions import db
from app.models import (
    Location, HistoricalEvent, Quiz, QuizQuestion, Badge
)


def load_json(filename):
    path = os.path.join(os.path.dirname(__file__), 'data', filename)
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)


def seed_badges():
    badges = [
        {
            'slug': 'first_steps',
            'name': 'First Steps',
            'description': 'Visited your first historical location.',
            'icon': '🗺️',
        },
        {
            'slug': 'explorer',
            'name': 'Explorer',
            'description': 'Visited 5 or more historical locations.',
            'icon': '🧭',
        },
        {
            'slug': 'native_scholar',
            'name': 'Native Grounds Scholar',
            'description': 'Passed all Era 1 (Tongva) quizzes.',
            'icon': '🌿',
        },
        {
            'slug': 'century_seeker',
            'name': 'Century Seeker',
            'description': 'Earned 500 total points.',
            'icon': '⭐',
        },
        {
            'slug': 'historian',
            'name': 'Historian',
            'description': 'Visited every location on the map.',
            'icon': '📜',
        },
        {
            'slug': 'spanish_era_complete',
            'name': 'Colonial Chronicles',
            'description': 'Passed all Era 2 (Spanish/Mexican) quizzes.',
            'icon': '⚓',
        },
        {
            'slug': 'rancho_era_complete',
            'name': 'Frontier Historian',
            'description': 'Passed all Era 3 (Rancho/American) quizzes.',
            'icon': '🏗️',
        },
        {
            'slug': 'modern_era_complete',
            'name': 'Modern LA Master',
            'description': 'Passed all Era 4 (Modern) quizzes.',
            'icon': '🌆',
        },
    ]
    for data in badges:
        if not Badge.query.filter_by(slug=data['slug']).first():
            db.session.add(Badge(**data))
    db.session.commit()
    print(f'  Seeded {len(badges)} badges.')


def seed_locations(location_data):
    count = 0
    for loc in location_data:
        if Location.query.filter_by(slug=loc['slug']).first():
            continue

        location = Location(
            name=loc['name'],
            slug=loc['slug'],
            latitude=loc['latitude'],
            longitude=loc['longitude'],
            era=loc['era'],
            era_order=loc['era_order'],
            is_starter=loc['is_starter'],
            unlock_threshold=loc.get('unlock_threshold', 0),
            short_description=loc['short_description'],
            full_description=loc['full_description'],
            image_url=loc.get('image_url'),
        )
        db.session.add(location)
        db.session.flush()  # get location.id before committing

        for event_data in loc.get('events', []):
            event = HistoricalEvent(
                location_id=location.id,
                title=event_data['title'],
                year=event_data['year'],
                year_display=event_data['year_display'],
                content=event_data['content'],
                order_index=event_data['order_index'],
            )
            db.session.add(event)

        count += 1

    db.session.commit()
    print(f'  Seeded {count} locations.')


def seed_quizzes(quiz_data, location_data):
    slug_to_id = {
        loc['slug']: Location.query.filter_by(slug=loc['slug']).first().id
        for loc in location_data
        if Location.query.filter_by(slug=loc['slug']).first()
    }

    count = 0
    for quiz in quiz_data:
        location_id = slug_to_id.get(quiz['location_slug'])
        if not location_id:
            print(f'  WARNING: No location found for slug "{quiz["location_slug"]}"')
            continue

        if Quiz.query.filter_by(location_id=location_id).first():
            continue

        q = Quiz(
            location_id=location_id,
            title=quiz['title'],
            passing_score=quiz.get('passing_score', 70),
            points_reward=quiz.get('points_reward', 50),
        )
        db.session.add(q)
        db.session.flush()

        for question in quiz['questions']:
            qq = QuizQuestion(
                quiz_id=q.id,
                question_text=question['question_text'],
                question_type=question['question_type'],
                option_a=question.get('option_a'),
                option_b=question.get('option_b'),
                option_c=question.get('option_c'),
                option_d=question.get('option_d'),
                correct_answer=question['correct_answer'],
                explanation=question.get('explanation'),
                order_index=question['order_index'],
            )
            db.session.add(qq)

        count += 1

    db.session.commit()
    print(f'  Seeded {count} quizzes.')


def main():
    app = create_app('development')
    with app.app_context():
        db.create_all()
        print('Seeding database...')

        location_data = load_json('locations.json')
        quiz_data = load_json('quizzes.json')

        seed_badges()
        seed_locations(location_data)
        seed_quizzes(quiz_data, location_data)

        print('Done! Database seeded successfully.')
        print(f'  Locations: {Location.query.count()}')
        print(f'  Events: {HistoricalEvent.query.count()}')
        print(f'  Quizzes: {Quiz.query.count()}')
        print(f'  Questions: {QuizQuestion.query.count()}')
        print(f'  Badges: {Badge.query.count()}')


if __name__ == '__main__':
    main()
