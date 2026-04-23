# Prompt Changelog — CONCEPT_MAP_CHAT_PROMPT

| Version | What Changed | Hypothesis | Key Result | Decision |
|---------|-------------|------------|------------|----------|
| v0 | Baseline from M2: 9-rule Socratic prompt with map-state branches (rules 4–6), off-topic redirect (rule 7), and 3-sentence cap (rule 2). | N/A — starting point. | TBD after scoring all 17 scenarios. | Starting point |
| v1 | Rule 2 revised: 3-sentence cap → "2–3 sentences; always end with a specific map question." Rules 10–13 added: (10) prior-knowledge probe before Socratic reframe on factual claims; (11) cognitive-floor reset after two consecutive deflections; (12) interrogate under-specified edge labels (1–3 words) for directionality/precision; (13) reject minimal replies ("idk", "sure", etc.) and anchor to a concrete map node. | Closing question targeting C4; diagnostic step targeting C2; edge-label interrogation targeting C3; deflection/minimal-reply handling covering Scenarios 5, 7, 16, 17. | TBD | Applied 2026-04-23 |
| v2 | TBD | TBD | TBD | TBD |
| v3 | TBD | TBD | TBD | TBD |
