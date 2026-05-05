import json
import requests
from flask import current_app


def _chat_once(base_url, payload, timeout):
    """Single Ollama /api/chat call. Returns (content_stripped_or_empty, raw_data_dict)."""
    response = requests.post(f'{base_url}/api/chat', json=payload, timeout=timeout)
    response.raise_for_status()
    data = response.json()
    content = (data.get('message', {}) or {}).get('content', '') or ''
    return content.strip(), data


def chat_with_ollama(messages, system_prompt):
    """
    Send a conversation to Ollama and return the assistant's reply.
    `messages` is a list of {'role': 'user'|'assistant', 'content': str}.
    Returns (reply_text, error_message). One will be None.
    """
    base_url = current_app.config.get('OLLAMA_BASE_URL', 'http://localhost:11434')
    model = current_app.config.get('OLLAMA_MODEL', 'gemma4:latest')

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
            timeout=120,
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


CONCEPT_MAP_CHAT_PROMPT = """

You are a Socratic history tutor embedded inside a concept-map building tool. The student is constructing a visual knowledge graph about {era_name} Los Angeles history.

ERA CONTEXT — use this to inform your questions, never recite it verbatim:
{locations_summary}

STUDENT'S CURRENT MAP:
{graph_summary}

YOUR ROLE — Constructionist scaffolding:
You guide the construction process, not evaluate the finished product. Every response should move that construction forward by making the student think more carefully about which nodes belong, why two things are connected, and what the relationship label means.

STRICT RULES — no exceptions:

1. NEVER state historical facts, dates, names, events, or causal claims — not as answers, not embedded in questions, not as scaffolding, not as "framing." If a fact about LA history appears in your response in any form (declarative, rhetorical, parenthetical, or as a leading clause inside a question), you have failed. The student must generate every historical claim themselves. Examples of forbidden patterns: "The Zoot Suit Riots were a violent clash in 1943 — what do you think…", "Given that the aqueduct was built to supply water…", "How did the 1935 opening of the Observatory…". If you find yourself writing a historical claim followed by a question, delete the claim.

2. Respond in 2–3 sentences. End every response with a single specific question that names exactly what the student should consider next on their map. Do not stack multiple questions; pick the strongest one.

3. Ask "why" or "how" at least once per response, and prefer questions that require the student to reason about cause, direction of influence, or comparison between two things — not just identification or recall. A question like "what year did that happen?" is too thin; "which of these two shaped the other, and what's your evidence?" is the target shape.

4. If the map has nodes but no edges yet, nudge toward relationships: ask what the student notices two specific nodes might share.

5. If the map is empty, ask which location they'd most want to start with and why. Do not lecture about the era.

6. If the map has edges, focus on one specific labeled edge and ask what evidence supports that label.

7. If the student asks something off-topic, redirect warmly in one sentence, then ask a question tied to a specific node on their map. Do not be cold or robotic.

8. Never suggest specific node names or edge labels the student hasn't proposed themselves.

9. Never praise without asking a deepening follow-up question.

10. When a student asks about a historical event or concept, your first move is always a prior-knowledge probe: "What do you already associate with [the thing]?" or "Why do you think it matters?" Do not pivot to map guidance until the student has shared what they know. The probe is a full response on its own — do not combine it with a redirect in the same turn.

11. If the student has deflected or ignored two consecutive tutor questions, do not repeat the same question a third time. Lower the cognitive floor: ask them to pick any two nodes on their map that might belong together, even as a weak hunch, and tell you which two.

12. If an edge label is one, two, or three words (e.g., ".", "related", "built for", "connected to", "influenced"), treat it as under-specified. Ask the student to evaluate its precision: what is the direction of that relationship, which thing caused or shaped the other, or what specifically happened between those two nodes that a single verb or short phrase is trying to capture.

13. If the student replies with a minimal or non-committal phrase ("idk", "yes", "no", "maybe", "sure", "ok", "I guess", "I don't know"), do not accept it as engagement and do not repeat your previous question. Treat it as an incomplete thought and ask them to anchor it to a specific node on their map.

14. MISCONCEPTION HANDLING — when the student states something factually wrong (e.g., "the LA River is natural", "the Watts Towers were built by the city government"), do not confirm it and do not correct it. Instead, run a two-step probe across two turns: first ask why they believe it or what made them think so; then, in your next turn, ask a sensory or evidence-based follow-up that points them toward what they would observe if they looked closely (the appearance of the thing, who would normally do that kind of work, what materials or scale would suggest). Never use the words "wrong", "incorrect", "actually", or "in fact". Your job is to make the student notice the problem themselves, not to surface it for them.

15. PROTECT ANALYTICAL DEPTH — the 2–3 sentence limit is not an excuse to drop to recall-level questions. If your response is short, the question at the end must do more work, not less. Prefer questions about direction of causation, comparison across nodes, or precision of an edge label over questions that ask the student to name or identify something.

16. CONSISTENCY ACROSS RESPONSES — these rules apply to every response you generate, not just the first attempt. If you generate multiple candidates, each must independently satisfy Rules 1–15. Do not let any response slip a historical fact through on the assumption that another response will be more careful.
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


def _summarize_graph_for_eval(graph_json):
    """Render every node and every edge (no cap) for concept-map evaluation."""
    if not graph_json:
        return "The map is empty."
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
            return "The map is empty."
        parts = [f"Nodes ({len(nodes)}): {', '.join(nodes)}."]
        if edges:
            parts.append(f"Edges ({len(edges)}):")
            parts.extend(f"- {e}" for e in edges)
        else:
            parts.append("No edges.")
        return "\n".join(parts)
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


QUIZ_HINT_PROMPT = """Quiz hint for a student studying {location_name} (Los Angeles history).

Context (do not reveal verbatim):
{location_description}

Question: {question_text}
Options:
{options_text}

Write a 2-3 sentence clue that points to the reasoning. Do not name the correct option or say "the answer is". Reference the context; guide thinking, not guessing.
"""


def get_quiz_hint(question, location):
    """
    Generate a Socratic hint for a quiz question using the location's description.
    Returns (hint_text, error). One will be None.
    """
    base_url = current_app.config.get('OLLAMA_BASE_URL', 'http://localhost:11434')
    model = current_app.config.get('OLLAMA_MODEL', 'gemma4:latest')

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
        'think': False,
        'options': {
            'num_predict': 260,
            'temperature': 0.5,
            'top_p': 0.9,
        },
    }

    try:
        hint, data = _chat_once(base_url, payload, 45)
        if not hint:
            current_app.logger.warning('Quiz hint empty; raw ollama response: %s', data)
            payload['options']['temperature'] = 0.8
            payload['options']['num_predict'] = 400
            hint, data = _chat_once(base_url, payload, 45)
            if not hint:
                current_app.logger.warning('Quiz hint empty after retry; raw: %s', data)
                return None, 'Hint service returned empty response.'
        return hint, None
    except requests.exceptions.ConnectionError:
        return None, 'Could not connect to Ollama. Make sure Ollama is running on port 11434.'
    except requests.exceptions.Timeout:
        return None, 'Hint took too long. Please try again.'
    except requests.exceptions.RequestException as e:
        return None, f'Hint service error: {str(e)}'


CONCEPT_MAP_INSIGHT_PROMPT = """Targeted concept-map hint for a student studying {era_name} Los Angeles history.

Era context (do not quote verbatim):
{locations_summary}

Student's current map:
{graph_summary}

Give 1-2 direct, concrete hints about connections they could add or strengthen. You may: name two nodes and explain the relationship, point out a missing link between existing nodes, or suggest a more precise label for an existing edge.

Max 3 sentences. Be direct and informative — no questions. Start with "Consider…" or "You might notice…".
"""


def get_concept_map_insight(era_name, locations_summary, graph_json):
    """
    Generate direct hints about connections in the student's in-progress concept map.
    Returns (insight_text, error). One will be None.
    """
    base_url = current_app.config.get('OLLAMA_BASE_URL', 'http://localhost:11434')
    model = current_app.config.get('OLLAMA_MODEL', 'gemma4:latest')

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
        'think': False,
        'options': {
            'num_predict': 300,
            'temperature': 0.5,
            'top_p': 0.9,
        },
    }

    try:
        insight, data = _chat_once(base_url, payload, 75)
        if not insight:
            current_app.logger.warning('Concept-map insight empty; raw ollama response: %s', data)
            payload['options']['temperature'] = 0.8
            payload['options']['num_predict'] = 500
            insight, data = _chat_once(base_url, payload, 75)
            if not insight:
                current_app.logger.warning('Concept-map insight empty after retry; raw: %s', data)
                return None, 'Insight service returned empty response.'
        return insight, None
    except requests.exceptions.ConnectionError:
        return None, 'Could not connect to Ollama. Make sure Ollama is running on port 11434.'
    except requests.exceptions.Timeout:
        return None, 'Insight took too long. Please try again.'
    except requests.exceptions.RequestException as e:
        return None, f'Insight service error: {str(e)}'


MEMORY_CHALLENGE_GEN_PROMPT = """Generate a memory challenge quiz for a student who just finished {era_name} Los Angeles history.

LOCATION FACTS (only source — do not invent facts beyond this list):
{locations_context}

Generate exactly {count} multiple-choice questions:
- Cover at least {spread} different locations
- Straightforward recall, not tricky; no negatively worded questions
- Each has 4 plausible options (a, b, c, d) with exactly one correct
- Each question must be grounded in a specific fact above

Rules:
1. Return ONLY valid JSON — no prose, no markdown fences
2. "correct_answer" is one lowercase letter: a, b, c, or d
3. "explanation" (1 sentence) cites the fact that makes the answer correct
4. "wrong_explanation_<letter>" (1 short sentence) is provided for each incorrect option

JSON shape:
{{
  "questions": [
    {{
      "question_text": "...",
      "option_a": "...",
      "option_b": "...",
      "option_c": "...",
      "option_d": "...",
      "correct_answer": "a",
      "explanation": "...",
      "wrong_explanation_b": "...",
      "wrong_explanation_c": "...",
      "wrong_explanation_d": "..."
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
    model = current_app.config.get('OLLAMA_MODEL', 'gemma4:latest')

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
        'think': False,
        'format': 'json',
        'options': {
            'num_predict': max(800, 180 * count),
            'temperature': 0.4,
            'top_p': 0.9,
        },
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


CONCEPT_MAP_EVAL_PROMPT = """Review a student's concept map about {era_name} Los Angeles history.

Location context (do not recite verbatim):
{locations_context}

Student's graph (edges formatted as "source --[label]--> target"):
{graph_summary}

For every edge, write a brief Socratic comment:
- If insightful/partially correct: ask one probing question
- If factually questionable: surface the concern as a question (never say "this is wrong")
- If surprising/creative: note it without over-praising

Rules:
1. Return ONLY valid JSON — no prose, no markdown fences
2. Do not tell the student what connections they should have made
3. No letter grades or percentages inside any comment text
4. Never praise a factually incorrect connection without a Socratic challenge
5. follow_up_question extends thinking beyond the map itself
6. synthesis_score is an integer 0-100 reflecting depth and accuracy

JSON shape:
{{
  "edge_feedback": [
    {{"source": "source node label", "target": "target node label", "label": "edge label", "comment": "Socratic question or observation"}}
  ],
  "overall_comment": "2-3 sentence synthesis — no grades, no percentages",
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
    model    = current_app.config.get('OLLAMA_MODEL', 'gemma4:latest')

    graph_summary = _summarize_graph_for_eval(graph_json)

    prompt = CONCEPT_MAP_EVAL_PROMPT.format(
        era_name=era_name,
        locations_context=locations_context,
        graph_summary=graph_summary,
    )

    payload = {
        'model': model,
        'messages': [{'role': 'user', 'content': prompt}],
        'stream': False,
        'think': False,
        'format': 'json',
        'options': {
            'num_predict': 1200,
            'temperature': 0.3,
            'top_p': 0.9,
        },
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
