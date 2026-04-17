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


CONCEPT_MAP_CHAT_PROMPT = """You are a Socratic history tutor embedded inside a concept-map building tool. The student is constructing a visual knowledge graph about {era_name} Los Angeles history.

ERA CONTEXT — use this to inform your questions, never recite it verbatim:
{locations_summary}

STUDENT'S CURRENT MAP:
{graph_summary}

YOUR ROLE — Constructionist scaffolding:
You guide the construction process, not evaluate the finished product. Every response should move that construction forward by making the student think more carefully about which nodes belong, why two things are connected, and what the relationship label means.

STRICT RULES — no exceptions:
1. NEVER directly answer a factual question. Respond with a probing question instead.
2. Keep every response to 3 sentences or fewer.
3. Ask "why" or "how" at least once per response.
4. If the map has nodes but no edges yet, nudge toward relationships: "What do you notice these locations might have in common?"
5. If the map is empty, ask which location they'd most want to start with and why.
6. If the map has edges, focus on one specific labeled edge and ask what evidence supports that label.
7. If the student asks something off-topic, redirect: "How might that connect to what you've placed on your map so far?"
8. Never suggest specific node names or edge labels the student hasn't proposed themselves.
9. Never praise without asking a deepening follow-up question.
"""


def _summarize_graph_for_chat(graph_json):
    """Convert raw cy.json() to a short human-readable summary for the system prompt."""
    if not graph_json:
        return "The map is currently empty."
    try:
        g = json.loads(graph_json) if isinstance(graph_json, str) else graph_json
        els = g.get('elements', {})
        if isinstance(els, dict):
            nodes = [n['data'].get('label', '?') for n in els.get('nodes', [])]
            edges = [
                f"{e['data'].get('source', '?')} --[{e['data'].get('label', '')}]--> {e['data'].get('target', '?')}"
                for e in els.get('edges', [])
            ]
        else:
            nodes = [e['data'].get('label', '?') for e in els if e.get('group') == 'nodes']
            edges = [
                f"{e['data'].get('source', '?')} --[{e['data'].get('label', '')}]--> {e['data'].get('target', '?')}"
                for e in els if e.get('group') == 'edges'
            ]
        if not nodes:
            return "The map is currently empty."
        summary = f"Nodes ({len(nodes)}): {', '.join(nodes)}."
        if edges:
            shown = edges[:10]
            summary += f" Connections ({len(edges)}): " + " | ".join(shown)
            if len(edges) > 10:
                summary += f" … and {len(edges) - 10} more."
        else:
            summary += " No connections drawn yet."
        return summary
    except Exception:
        return "Map state unavailable."


def build_concept_map_chat_prompt(era_name, locations_summary, graph_json):
    """Build the system prompt for concept-map-integrated Socratic chat."""
    graph_summary = _summarize_graph_for_chat(graph_json)
    return CONCEPT_MAP_CHAT_PROMPT.format(
        era_name=era_name,
        locations_summary=locations_summary,
        graph_summary=graph_summary,
    )


QUIZ_HINT_PROMPT = """You are helping a student who is answering a history quiz about {location_name}, a historical site in Los Angeles.

LOCATION CONTEXT (use to inform your hint — do not reveal this directly):
{location_description}

QUESTION:
{question_text}

OPTIONS:
{options_text}

Your task: Write a 2-3 sentence contextual clue that helps the student reason toward the answer WITHOUT naming the correct option or saying phrases like "the answer is" or "option X is correct." Reference specific historical context from the location. Guide their thinking, not their guessing.
"""


def get_quiz_hint(question, location):
    """
    Generate a Socratic hint for a quiz question using the location's description.
    Returns (hint_text, error). One will be None.
    """
    base_url = current_app.config.get('OLLAMA_BASE_URL', 'http://localhost:11434')
    model = current_app.config.get('OLLAMA_MODEL', 'llama3.2')

    options_lines = []
    for key in ('a', 'b', 'c', 'd'):
        val = getattr(question, f'option_{key}', None)
        if val:
            options_lines.append(f'{key.upper()}) {val}')
    if question.question_type == 'true_false':
        options_lines = ['A) True', 'B) False']

    prompt = QUIZ_HINT_PROMPT.format(
        location_name=location.name,
        location_description=location.full_description[:400],
        question_text=question.question_text,
        options_text='\n'.join(options_lines),
    )

    payload = {
        'model': model,
        'messages': [{'role': 'user', 'content': prompt}],
        'stream': False,
    }

    try:
        response = requests.post(f'{base_url}/api/chat', json=payload, timeout=30)
        response.raise_for_status()
        data = response.json()
        hint = data.get('message', {}).get('content', '').strip()
        if not hint:
            return None, 'Hint service returned empty response.'
        return hint, None
    except requests.exceptions.ConnectionError:
        return None, 'Could not connect to Ollama. Make sure Ollama is running on port 11434.'
    except requests.exceptions.Timeout:
        return None, 'Hint took too long. Please try again.'
    except requests.exceptions.RequestException as e:
        return None, f'Hint service error: {str(e)}'


CONCEPT_MAP_INSIGHT_PROMPT = """You are a helpful history hint assistant. A student is building a concept map about {era_name} Los Angeles history and has spent points to get a targeted hint.

ERA CONTEXT (draw from this to suggest connections — do not quote it verbatim):
{locations_summary}

STUDENT'S CURRENT MAP:
{graph_summary}

Your task: Give 1-2 direct, concrete hints about connections the student could add or strengthen. You MAY:
- Name two specific nodes and explain how they are related (e.g., "Consider how Mission San Gabriel relates to agriculture in the Rancho era — missions trained the labor force that later worked the ranchos.")
- Point out a missing link between nodes already on the map
- Suggest a more precise label for an existing connection

Keep your response to 3 sentences maximum. Be direct and informative — this is a hint, not a question. Do not ask questions. Start with "Consider…" or "You might notice…" to signal this is a suggestion.
"""


def get_concept_map_insight(era_name, locations_summary, graph_json):
    """
    Generate direct hints about connections in the student's in-progress concept map.
    Returns (insight_text, error). One will be None.
    """
    base_url = current_app.config.get('OLLAMA_BASE_URL', 'http://localhost:11434')
    model = current_app.config.get('OLLAMA_MODEL', 'llama3.2')

    graph_summary = _summarize_graph_for_chat(graph_json)

    prompt = CONCEPT_MAP_INSIGHT_PROMPT.format(
        era_name=era_name,
        locations_summary=locations_summary,
        graph_summary=graph_summary,
    )

    payload = {
        'model': model,
        'messages': [{'role': 'user', 'content': prompt}],
        'stream': False,
    }

    try:
        response = requests.post(f'{base_url}/api/chat', json=payload, timeout=45)
        response.raise_for_status()
        data = response.json()
        insight = data.get('message', {}).get('content', '').strip()
        if not insight:
            return None, 'Insight service returned empty response.'
        return insight, None
    except requests.exceptions.ConnectionError:
        return None, 'Could not connect to Ollama. Make sure Ollama is running on port 11434.'
    except requests.exceptions.Timeout:
        return None, 'Insight took too long. Please try again.'
    except requests.exceptions.RequestException as e:
        return None, f'Insight service error: {str(e)}'


MEMORY_CHALLENGE_GEN_PROMPT = """You are creating a memory challenge quiz for a student who just finished studying {era_name} Los Angeles history.

LOCATION FACTS (use only these as your source — do not invent facts outside this list):
{locations_context}

TASK: Generate exactly {count} multiple-choice questions that test recall of the facts above.

GUIDELINES:
- Cover at least {spread} different locations (do not ask all questions about the same place)
- Questions should be straightforward and accessible, not tricky or obscure
- Each question has exactly 4 answer choices (A, B, C, D) with one clearly correct answer
- Avoid negatively worded questions ("Which is NOT...")
- Base every question on a specific fact stated in the location context above

STRICT RULES:
1. Return ONLY valid JSON — no prose, no markdown fences, nothing outside the JSON
2. The "correct_answer" field must be exactly one lowercase letter: a, b, c, or d
3. All four options must be plausible but only one correct
4. The "explanation" field (1 sentence) must cite the specific fact that makes the answer correct

REQUIRED JSON STRUCTURE (exactly these keys, no others):
{{
  "questions": [
    {{
      "question_text": "...",
      "option_a": "...",
      "option_b": "...",
      "option_c": "...",
      "option_d": "...",
      "correct_answer": "a",
      "explanation": "..."
    }}
  ]
}}"""


def generate_memory_challenge_questions(era_name, locations_context, count=8):
    """
    Ask Ollama to generate `count` fresh multiple-choice questions for a memory challenge.
    Returns (questions_list, error). One will be None.
    Each question dict includes: id (string), question_text, option_a/b/c/d,
    correct_answer, explanation, question_type, order_index.
    """
    base_url = current_app.config.get('OLLAMA_BASE_URL', 'http://localhost:11434')
    model = current_app.config.get('OLLAMA_MODEL', 'llama3.2')

    spread = max(3, count // 2)

    prompt = MEMORY_CHALLENGE_GEN_PROMPT.format(
        era_name=era_name,
        locations_context=locations_context,
        count=count,
        spread=spread,
    )

    payload = {
        'model': model,
        'messages': [{'role': 'user', 'content': prompt}],
        'stream': False,
        'format': 'json',
    }

    raw = ''
    try:
        response = requests.post(f'{base_url}/api/chat', json=payload, timeout=90)
        response.raise_for_status()
        data = response.json()
        raw = data.get('message', {}).get('content', '').strip()
        if not raw:
            return None, 'Question generator returned empty response.'

        parsed = json.loads(raw)
        questions = parsed.get('questions', [])
        if not questions:
            return None, 'No questions generated.'

        validated = []
        required_keys = ('question_text', 'option_a', 'option_b', 'option_c', 'option_d', 'correct_answer')
        for i, q in enumerate(questions[:count]):
            if not all(k in q for k in required_keys):
                continue
            if q['correct_answer'].lower() not in ('a', 'b', 'c', 'd'):
                continue
            q['id'] = f'ai_{i}'
            q['question_type'] = 'multiple_choice'
            q['order_index'] = i
            validated.append(q)

        if not validated:
            return None, 'Generated questions failed validation.'

        return validated, None

    except json.JSONDecodeError:
        return None, f'Could not parse generated questions.'
    except requests.exceptions.ConnectionError:
        return None, 'Could not connect to Ollama.'
    except requests.exceptions.Timeout:
        return None, 'Question generation timed out.'
    except requests.exceptions.RequestException as e:
        return None, f'Question generation error: {str(e)}'


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
