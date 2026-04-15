from datetime import datetime
from ..extensions import db


class ConceptMap(db.Model):
    __tablename__ = 'concept_maps'
    __table_args__ = (
        db.UniqueConstraint('user_id', 'era_order', name='uq_user_era_concept_map'),
    )

    id            = db.Column(db.Integer, primary_key=True)
    user_id       = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    era_order     = db.Column(db.Integer, nullable=False)
    graph_json    = db.Column(db.Text, nullable=True)   # full cy.json() string
    submitted     = db.Column(db.Boolean, default=False)
    ai_feedback   = db.Column(db.Text, nullable=True)   # JSON string from Ollama
    points_earned = db.Column(db.Integer, default=0)
    insight_uses  = db.Column(db.Integer, default=3, nullable=False)  # AI insight tokens remaining
    created_at    = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at    = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            'id':            self.id,
            'user_id':       self.user_id,
            'era_order':     self.era_order,
            'graph_json':    self.graph_json,
            'submitted':     self.submitted,
            'ai_feedback':   self.ai_feedback,
            'points_earned': self.points_earned,
            'insight_uses':  self.insight_uses if self.insight_uses is not None else 3,
            'created_at':    self.created_at.isoformat() if self.created_at else None,
            'updated_at':    self.updated_at.isoformat() if self.updated_at else None,
        }

    def __repr__(self):
        return f'<ConceptMap user={self.user_id} era={self.era_order} submitted={self.submitted}>'


class MemoryChallengeAttempt(db.Model):
    __tablename__ = 'memory_challenge_attempts'
    __table_args__ = (
        db.UniqueConstraint('user_id', 'era_order', name='uq_user_era_challenge'),
    )

    id           = db.Column(db.Integer, primary_key=True)
    user_id      = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    era_order    = db.Column(db.Integer, nullable=False)
    attempted           = db.Column(db.Boolean, default=False, nullable=False)
    passed              = db.Column(db.Boolean, nullable=True)
    score_pct           = db.Column(db.Integer, nullable=True)
    question_ids        = db.Column(db.Text, nullable=True)   # JSON array of DB question IDs (fallback path)
    generated_questions = db.Column(db.Text, nullable=True)   # JSON array of AI-generated question objects (preferred path)
    attempted_at        = db.Column(db.DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f'<MemoryChallengeAttempt user={self.user_id} era={self.era_order} passed={self.passed}>'
