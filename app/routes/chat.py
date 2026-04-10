from flask import Blueprint, jsonify, request
from flask_login import login_required, current_user
from ..extensions import db
from ..models.location import Location
from ..models.progress import ChatSession, ChatMessage
from ..services.ollama_service import build_system_prompt, chat_with_ollama

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

    user_message = data['message'].strip()[:1000]  # cap input length
    location_id = data.get('location_id')

    location = None
    if location_id:
        location = Location.query.get(location_id)

    # Get or create chat session
    session = get_or_create_session(current_user.id, location_id)

    # Build conversation history for Ollama
    past_messages = [
        {'role': msg.role, 'content': msg.content}
        for msg in session.messages
    ]
    past_messages.append({'role': 'user', 'content': user_message})

    # Build system prompt
    if location:
        system_prompt = build_system_prompt(location, current_user)
    else:
        system_prompt = (
            "You are a Socratic history tutor for Los Angeles history. "
            "Guide the student with questions rather than answers. "
            "Keep responses under 4 sentences."
        )

    # Call Ollama
    reply, error = chat_with_ollama(past_messages, system_prompt)

    if error:
        return jsonify({'error': error}), 503

    # Persist both messages
    db.session.add(ChatMessage(session_id=session.id, role='user', content=user_message))
    db.session.add(ChatMessage(session_id=session.id, role='assistant', content=reply))
    db.session.commit()

    return jsonify({'reply': reply})


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
