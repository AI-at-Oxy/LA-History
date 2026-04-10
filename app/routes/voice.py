import requests
from flask import Blueprint, jsonify, request, current_app
from flask_login import login_required
from ..extensions import limiter

voice_bp = Blueprint('voice', __name__)

# Audio MIME types accepted for Ollama transcription
ACCEPTED_AUDIO_TYPES = {'audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/wav'}
MAX_AUDIO_BYTES = 10 * 1024 * 1024  # 10 MB hard limit


def _get_ollama_base():
    return current_app.config.get('OLLAMA_BASE_URL', 'http://localhost:11434')


def _get_ollama_model():
    return current_app.config.get('OLLAMA_MODEL', 'llama3.2')


@voice_bp.route('/api/voice/health', methods=['GET'])
@login_required
def voice_health():
    """
    Check whether the configured Ollama instance is reachable and has an
    audio-capable model available.  Returns:
      { available: bool, model: str|null, reason: str }
    """
    base_url = _get_ollama_base()
    model = _get_ollama_model()

    try:
        resp = requests.get(f'{base_url}/api/tags', timeout=5)
        resp.raise_for_status()
        data = resp.json()
        models = [m.get('name', '') for m in data.get('models', [])]

        # Check whether the configured model is present
        # (We can't reliably detect audio capability from tags alone,
        #  so we report the model as available if it exists in the list.)
        model_available = any(m == model or m.startswith(model + ':') for m in models)

        if model_available:
            return jsonify({'available': True, 'model': model, 'reason': 'ok'})
        else:
            return jsonify({
                'available': False,
                'model': None,
                'reason': f'Model "{model}" not found in Ollama. Pull it first.'
            })

    except requests.exceptions.ConnectionError:
        return jsonify({'available': False, 'model': None, 'reason': 'Ollama not reachable'})
    except requests.exceptions.Timeout:
        return jsonify({'available': False, 'model': None, 'reason': 'Ollama health check timed out'})
    except requests.exceptions.RequestException as e:
        return jsonify({'available': False, 'model': None, 'reason': str(e)})


@voice_bp.route('/api/voice/transcribe', methods=['POST'])
@login_required
@limiter.limit('10 per minute')
def voice_transcribe():
    """
    Receive a raw audio blob (multipart/form-data, field "audio") and forward
    it to the Ollama multimodal model for transcription.

    Returns: { transcript: str }
    Errors:  400 on bad input, 503 on Ollama failure
    """
    if 'audio' not in request.files:
        return jsonify({'error': 'No audio file provided.'}), 400

    audio_file = request.files['audio']
    audio_bytes = audio_file.read()

    if not audio_bytes:
        return jsonify({'error': 'Audio file is empty.'}), 400

    if len(audio_bytes) > MAX_AUDIO_BYTES:
        return jsonify({'error': 'Audio file too large (max 10 MB).'}), 400

    # Validate MIME type from the Content-Type header of the file part
    mime_type = audio_file.content_type or ''
    base_mime = mime_type.split(';')[0].strip().lower()
    if base_mime and base_mime not in ACCEPTED_AUDIO_TYPES:
        return jsonify({'error': f'Unsupported audio type: {mime_type}'}), 400

    base_url = _get_ollama_base()
    model = _get_ollama_model()

    # Determine a reasonable file extension for Ollama
    ext_map = {
        'audio/webm': 'webm',
        'audio/ogg': 'ogg',
        'audio/mp4': 'mp4',
        'audio/mpeg': 'mp3',
        'audio/wav': 'wav',
    }
    ext = ext_map.get(base_mime, 'webm')

    try:
        # Forward audio to Ollama's generate endpoint with a transcription prompt.
        # Note: actual audio transcription support depends on the model pulled.
        # llama3.2-vision and whisper-compatible models may support this.
        resp = requests.post(
            f'{base_url}/api/generate',
            files={'file': (f'audio.{ext}', audio_bytes, mime_type)},
            data={
                'model': model,
                'prompt': 'Transcribe the speech in this audio recording. Return only the transcribed text, nothing else.',
                'stream': 'false',
            },
            timeout=30,
        )
        resp.raise_for_status()
        data = resp.json()
        transcript = data.get('response', '').strip()

        if not transcript:
            return jsonify({'error': 'Ollama returned an empty transcript.'}), 503

        return jsonify({'transcript': transcript})

    except requests.exceptions.ConnectionError:
        return jsonify({'error': 'Could not connect to Ollama for transcription.'}), 503
    except requests.exceptions.Timeout:
        return jsonify({'error': 'Ollama transcription timed out.'}), 503
    except requests.exceptions.RequestException as e:
        return jsonify({'error': f'Transcription service error: {str(e)}'}), 503
