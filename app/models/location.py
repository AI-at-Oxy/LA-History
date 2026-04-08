from datetime import datetime
from ..extensions import db


class Location(db.Model):
    __tablename__ = 'locations'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False)
    slug = db.Column(db.String(100), unique=True, nullable=False)
    latitude = db.Column(db.Float, nullable=False)
    longitude = db.Column(db.Float, nullable=False)
    era = db.Column(db.String(50), nullable=False)  # native, spanish, rancho, modern
    era_order = db.Column(db.Integer, nullable=False)  # 1-4
    short_description = db.Column(db.Text, nullable=False)
    full_description = db.Column(db.Text, nullable=False)
    unlock_threshold = db.Column(db.Integer, default=0)
    is_starter = db.Column(db.Boolean, default=False)
    image_url = db.Column(db.String(300), nullable=True)
    image_caption = db.Column(db.String(500), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Relationships
    events = db.relationship('HistoricalEvent', backref='location', lazy='dynamic',
                             cascade='all, delete-orphan', order_by='HistoricalEvent.order_index')
    quiz = db.relationship('Quiz', backref='location', uselist=False, cascade='all, delete-orphan')
    progress_records = db.relationship('UserProgress', backref='location', lazy='dynamic',
                                       cascade='all, delete-orphan')

    def __repr__(self):
        return f'<Location {self.name}>'

    def to_dict(self, user_progress=None):
        data = {
            'id': self.id,
            'name': self.name,
            'slug': self.slug,
            'latitude': self.latitude,
            'longitude': self.longitude,
            'era': self.era,
            'era_order': self.era_order,
            'short_description': self.short_description,
            'is_starter': self.is_starter,
            'image_url': self.image_url,
            'image_caption': self.image_caption,
            'has_quiz': self.quiz is not None,
        }
        if user_progress:
            data['visited'] = user_progress.visited
            data['quiz_passed'] = user_progress.quiz_passed
            data['quiz_score'] = user_progress.quiz_score
            data['points_earned'] = user_progress.points_earned
            data['unlocked'] = True
        else:
            data['visited'] = False
            data['quiz_passed'] = False
            data['quiz_score'] = None
            data['points_earned'] = 0
            data['unlocked'] = self.is_starter
        return data


class HistoricalEvent(db.Model):
    __tablename__ = 'historical_events'

    id = db.Column(db.Integer, primary_key=True)
    location_id = db.Column(db.Integer, db.ForeignKey('locations.id'), nullable=False)
    title = db.Column(db.String(200), nullable=False)
    year = db.Column(db.Integer, nullable=False)
    year_display = db.Column(db.String(50), nullable=False)
    content = db.Column(db.Text, nullable=False)
    order_index = db.Column(db.Integer, nullable=False, default=0)

    def __repr__(self):
        return f'<HistoricalEvent {self.title}>'

    def to_dict(self):
        return {
            'id': self.id,
            'title': self.title,
            'year': self.year,
            'year_display': self.year_display,
            'content': self.content,
        }
