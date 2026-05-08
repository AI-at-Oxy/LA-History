# `data/` Directory

This directory holds the evaluation data and user testing artifacts for LA History. Per the COMP 395 Final Project specification, it contains three required files:

| File | Purpose |
|---|---|
| [`scenarios.md`](scenarios.md) | The 17 test scenarios used to evaluate every prompt version (v0–v3) against the four-criterion rubric. |
| [`user_testing_protocol.md`](user_testing_protocol.md) | The protocol script all observers followed during user testing sessions. |
| [`user_testing_notes.md`](user_testing_notes.md) | Anonymized observation notes from the four user testing sessions, plus cross-participant pattern analysis. |

## How These Files Relate

The three files form a chain that flows from prompt evaluation to design iteration:

```
scenarios.md ──► used to score every version of prompts/system_prompt_v*.txt
                 (per-version score tables live in the final report, Appendix B)

user_testing_protocol.md ──► the script for each session
                              │
                              ▼
                user_testing_notes.md (anonymized session writeups)
                              │
                              ▼
                  Cross-participant patterns identified
                              │
                              ▼
        Design changes documented in the final report (§5.3)
        and partially reflected in prompts/system_prompt_v3.txt
```

## Anonymization Policy

`user_testing_notes.md` has been audited to remove personally identifying information. Participants are referred to only as P1, P2, P3, P4. No real names, emails, or institutional identifiers appear anywhere in this directory. The audit checklist is at the bottom of `user_testing_notes.md`.

If you find a residual identifier, file an issue or open a PR to remove it.

## Reuse

The structure of `scenarios.md` (genuine curiosity / misconceptions / edge cases / off-topic / deflection pressure tests) is reusable for any Socratic-tutor project; only the domain-specific content (LA history) would need to change. The user testing protocol is similarly portable — the introduction script and think-aloud guidance work for any web-based learning app.

Both files are released under the same license as the rest of the repository.
