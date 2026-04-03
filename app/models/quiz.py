from ..extensions import db


class Quiz(db.Model):
    __tablename__ = 'quizzes'

    id = db.Column(db.Integer, primary_key=True)
    location_id = db.Column(db.Integer, db.ForeignKey('locations.id'), nullable=False, unique=True)
    title = db.Column(db.String(200), nullable=False)
    passing_score = db.Column(db.Integer, default=70)   # percentage
    points_reward = db.Column(db.Integer, default=50)

    questions = db.relationship('QuizQuestion', backref='quiz', lazy='dynamic',
                                cascade='all, delete-orphan',
                                order_by='QuizQuestion.order_index')

    def __repr__(self):
        return f'<Quiz {self.title}>'

    def to_dict(self, include_answers=False):
        data = {
            'id': self.id,
            'location_id': self.location_id,
            'title': self.title,
            'passing_score': self.passing_score,
            'points_reward': self.points_reward,
            'questions': [q.to_dict(include_answers=include_answers)
                          for q in self.questions],
        }
        return data


class QuizQuestion(db.Model):
    __tablename__ = 'quiz_questions'

    id = db.Column(db.Integer, primary_key=True)
    quiz_id = db.Column(db.Integer, db.ForeignKey('quizzes.id'), nullable=False)
    question_text = db.Column(db.Text, nullable=False)
    question_type = db.Column(db.String(20), nullable=False)  # multiple_choice, true_false
    option_a = db.Column(db.Text, nullable=True)
    option_b = db.Column(db.Text, nullable=True)
    option_c = db.Column(db.Text, nullable=True)
    option_d = db.Column(db.Text, nullable=True)
    correct_answer = db.Column(db.String(1), nullable=False)  # a/b/c/d or t/f
    explanation = db.Column(db.Text, nullable=True)
    order_index = db.Column(db.Integer, nullable=False, default=0)

    def __repr__(self):
        return f'<QuizQuestion {self.id}>'

    def to_dict(self, include_answers=False):
        data = {
            'id': self.id,
            'question_text': self.question_text,
            'question_type': self.question_type,
            'option_a': self.option_a,
            'option_b': self.option_b,
            'option_c': self.option_c,
            'option_d': self.option_d,
            'order_index': self.order_index,
        }
        if include_answers:
            data['correct_answer'] = self.correct_answer
            data['explanation'] = self.explanation
        return data
