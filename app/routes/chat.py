import json
import requests
from flask import Blueprint, jsonify, request, Response, stream_with_context
from flask_login import login_required, current_user
from ..extensions import db
from ..models.progress import ChatSession, ChatMessage
from ..services.ollama_service import stream_chat_with_ollama

chat_bp = Blueprint('chat', __name__)


def get_or_create_session(user_id, location_id):
    session = ChatSession.query.filter_by(
        user_id=user_id, location_id=location_id
    ).first()
    if not session:
        session = ChatSession(user_id=user_id, location_id=location_id)
        db.session.add(session)
        db.session.flush()
    return session


@chat_bp.route('/api/chat', methods=['POST'])
@login_required
def chat():
    data = request.get_json()
    if not data or not data.get('message', '').strip():
        return jsonify({'error': 'Message is required.'}), 400

    user_message = data['message'].strip()[:1000]
    location_id = data.get('location_id')

    session = get_or_create_session(current_user.id, location_id)

    past_messages = [
        {'role': msg.role, 'content': msg.content}
        for msg in session.messages
    ]
    past_messages.append({'role': 'user', 'content': user_message})

    system_prompt = (
        "You are a Socratic history tutor for Los Angeles history. "
        "Guide the student with questions rather than answers. "
        "Keep responses under 4 sentences."
    )

    session_id = session.id

    def generate():
        accumulated = []
        try:
            for token in stream_chat_with_ollama(past_messages, system_prompt):
                accumulated.append(token)
                yield f"data: {json.dumps({'token': token})}\n\n"
        except requests.exceptions.ConnectionError:
            yield f"data: {json.dumps({'error': 'Could not connect to Ollama. Make sure Ollama is running locally on port 11434.'})}\n\n"
            return
        except requests.exceptions.Timeout:
            yield f"data: {json.dumps({'error': 'The tutor took too long to respond. Please try again.'})}\n\n"
            return
        except requests.exceptions.RequestException as e:
            yield f"data: {json.dumps({'error': f'Tutor service error: {str(e)}'})}\n\n"
            return

        full_reply = ''.join(accumulated)
        if full_reply:
            try:
                db.session.add(ChatMessage(session_id=session_id, role='user', content=user_message))
                db.session.add(ChatMessage(session_id=session_id, role='assistant', content=full_reply))
                db.session.commit()
            except Exception:
                db.session.rollback()

        yield f"data: {json.dumps({'done': True})}\n\n"

    resp = Response(stream_with_context(generate()), mimetype='text/event-stream')
    resp.headers['X-Accel-Buffering'] = 'no'
    resp.headers['Cache-Control'] = 'no-cache'
    return resp


@chat_bp.route('/api/chat/history', methods=['GET'])
@login_required
def get_general_history():
    session = ChatSession.query.filter_by(
        user_id=current_user.id, location_id=None
    ).first()
    if not session:
        return jsonify({'messages': []})
    messages = [msg.to_dict() for msg in session.messages]
    return jsonify({'messages': messages})


@chat_bp.route('/api/chat/history/<int:location_id>')
@login_required
def get_history(location_id):
    session = ChatSession.query.filter_by(
        user_id=current_user.id, location_id=location_id
    ).first()

    if not session:
        return jsonify({'messages': []})

    messages = [msg.to_dict() for msg in session.messages]
    return jsonify({'messages': messages})


@chat_bp.route('/api/chat/history', methods=['DELETE'])
@login_required
def clear_history():
    sessions = ChatSession.query.filter_by(user_id=current_user.id).all()
    for session in sessions:
        ChatMessage.query.filter_by(session_id=session.id).delete()
        db.session.delete(session)
    db.session.commit()
    return jsonify({'success': True})
