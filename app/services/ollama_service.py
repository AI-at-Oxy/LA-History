import json
import requests
from flask import current_app

SYSTEM_PROMPT_TEMPLATE = """You are a Socratic history tutor helping a student explore Los Angeles history.

Your current context is the historical site: {location_name} (Era: {era}).

Location background (do not recite this — use it to inform your questions):
{location_summary}

The student's progress: visited {visited_count} location(s), earned {total_points} point(s).

RULES YOU MUST FOLLOW — no exceptions:
1. NEVER directly answer a factual question. Always respond with a guiding question instead.
2. If the student gives a correct answer, affirm briefly and deepen with a follow-up: "What do you think led to...?" or "Why might that have mattered for...?"
3. If the student gives a wrong answer, never say "wrong" or "incorrect." Instead ask: "What makes you think that? What evidence from the description supports it?"
4. Keep every response under 4 sentences.
5. Always tie your question back to this specific location and era when possible.
6. If the student asks something off-topic, gently redirect: "That's interesting — how might that connect to what happened at {location_name}?"
7. Never lecture. Only ask questions or offer very brief affirmations.
"""


def build_system_prompt(location, user):
    summary = location.full_description[:300] + '...' if len(location.full_description) > 300 else location.full_description

    visited_count = sum(
        1 for p in user.progress if p.visited
    )

    return SYSTEM_PROMPT_TEMPLATE.format(
        location_name=location.name,
        era=location.era.capitalize(),
        location_summary=summary,
        visited_count=visited_count,
        total_points=user.total_points or 0,
    )


def chat_with_ollama(messages, system_prompt):
    """
    Send a conversation to Ollama and return the assistant's reply.
    `messages` is a list of {'role': 'user'|'assistant', 'content': str}.
    Returns (reply_text, error_message). One will be None.
    """
    base_url = current_app.config.get('OLLAMA_BASE_URL', 'http://localhost:11434')
    model = current_app.config.get('OLLAMA_MODEL', 'llama3.2')

    # Rolling context: keep last 6 messages (3 exchanges) to avoid token bloat
    recent_messages = messages[-6:] if len(messages) > 6 else messages

    payload = {
        'model': model,
        'messages': [{'role': 'system', 'content': system_prompt}] + recent_messages,
        'stream': False,
    }

    try:
        response = requests.post(
            f'{base_url}/api/chat',
            json=payload,
            timeout=60,
        )
        response.raise_for_status()
        data = response.json()
        reply = data.get('message', {}).get('content', '').strip()
        if not reply:
            return None, 'The tutor returned an empty response. Please try again.'
        return reply, None
    except requests.exceptions.ConnectionError:
        return None, 'Could not connect to Ollama. Make sure Ollama is running locally on port 11434.'
    except requests.exceptions.Timeout:
        return None, 'The tutor took too long to respond. Please try again.'
    except requests.exceptions.RequestException as e:
        return None, f'Tutor service error: {str(e)}'


CONCEPT_MAP_EVAL_PROMPT = """You are reviewing a student's concept map about {era_name} Los Angeles history.

LOCATION CONTEXT (use to assess connections — do not recite verbatim):
{locations_context}

STUDENT'S GRAPH:
{graph_json}

YOUR TASK:
For every directed edge in the graph, write a brief Socratic comment that:
- Asks one probing question if the connection seems insightful or partially correct
- Gently surfaces a factual concern through a question if something seems inaccurate (never say "this is wrong")
- Notes surprising or creative connections without over-praising

STRICT RULES — no exceptions:
1. Return ONLY valid JSON — no prose, no markdown fences before or after the JSON
2. Never tell the student what connections they SHOULD have made
3. Never assign a letter grade or include a percentage in any comment text
4. Never praise a factually incorrect connection without raising a Socratic challenge
5. The follow_up_question must extend the student's thinking beyond the map itself
6. synthesis_score is an integer 0-100 reflecting conceptual depth and accuracy

REQUIRED JSON STRUCTURE (exactly these keys, no others):
{{
  "edge_feedback": [
    {{"source": "source node label", "target": "target node label", "label": "edge label", "comment": "Socratic question or observation"}}
  ],
  "overall_comment": "2-3 sentence synthesis observation — no grades, no percentages",
  "synthesis_score": 72,
  "follow_up_question": "One open-ended question to extend thinking"
}}"""


def evaluate_concept_map(era_name, locations_context, graph_json):
    """
    Send a student's concept map to Ollama for Socratic evaluation.
    Returns (feedback_dict, error). One will be None.
    feedback_dict keys: edge_feedback, overall_comment, synthesis_score, follow_up_question
    """
    base_url = current_app.config.get('OLLAMA_BASE_URL', 'http://localhost:11434')
    model    = current_app.config.get('OLLAMA_MODEL', 'llama3.2')

    prompt = CONCEPT_MAP_EVAL_PROMPT.format(
        era_name=era_name,
        locations_context=locations_context,
        graph_json=graph_json,
    )

    payload = {
        'model': model,
        'messages': [{'role': 'user', 'content': prompt}],
        'stream': False,
        'format': 'json',
    }

    raw = ''
    try:
        response = requests.post(
            f'{base_url}/api/chat',
            json=payload,
            timeout=120,
        )
        response.raise_for_status()
        data = response.json()
        raw = data.get('message', {}).get('content', '').strip()
        if not raw:
            return None, 'The evaluator returned an empty response. Please try again.'

        feedback = json.loads(raw)
        feedback.setdefault('edge_feedback', [])
        feedback.setdefault('overall_comment', '')
        feedback.setdefault('synthesis_score', 0)
        feedback.setdefault('follow_up_question', '')
        return feedback, None

    except json.JSONDecodeError:
        fallback = {
            'edge_feedback': [],
            'overall_comment': raw[:500] if raw else 'The evaluator response could not be parsed.',
            'synthesis_score': 0,
            'follow_up_question': 'What patterns do you notice across the connections you drew?',
        }
        return fallback, None
    except requests.exceptions.ConnectionError:
        return None, 'Could not connect to Ollama. Make sure Ollama is running on port 11434.'
    except requests.exceptions.Timeout:
        return None, 'The evaluator took too long. Please try again.'
    except requests.exceptions.RequestException as e:
        return None, f'Evaluation service error: {str(e)}'
