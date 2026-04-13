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
            'created_at':    self.created_at.isoformat() if self.created_at else None,
            'updated_at':    self.updated_at.isoformat() if self.updated_at else None,
        }

    def __repr__(self):
        return f'<ConceptMap user={self.user_id} era={self.era_order} submitted={self.submitted}>'
