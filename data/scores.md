# Per-Version Evaluation Scores

This file holds the full per-criterion, per-scenario scoring evidence for every version of the AI tutor system prompt (v0 → v3). Scenarios are defined in [`../data/scenarios.md`](../data/scenarios.md). Rubric and behavioral anchors are in [`rubric.md`](rubric.md). Prompt changes between versions are documented in [`../prompts/CHANGELOG.md`](../prompts/CHANGELOG.md).

## Scoring Convention

Each scenario was independently run through two different local-model outputs and scored separately. The two scores per criterion are summed for a per-criterion maximum of **8** (4 + 4). All four criteria sum to a per-scenario maximum of **32**.

In the per-scenario tables below, each cell contains the two scores as a pair (e.g., `4,2` = first model output scored 4, second scored 2; sum is 6 toward the criterion total).

## Quick Summary

| Version | Mean (/32) | Δ vs. previous | Best version on |
|---|---|---|---|
| v0 | 21.94 | — (baseline) | — |
| v1 | 22.24 | +0.29 | (none — incremental) |
| **v2** | **25.77** | **+3.53** | **13 of 17 scenarios** |
| v3 | 24.53 | −1.24 | 4 of 17 scenarios; only version that regressed |

**v2 is the production-deployed version.** v3's regression analysis (see [`rubric.md`](rubric.md) and the final report §4.6.3) concluded that v3 over-corrected toward minimalism, costing analytical depth (C3) more than it gained in clarity (C4).

## Per-Criterion Means (Max 4)

| Criterion | v0 | v1 | v2 | v3 |
|---|---|---|---|---|
| C1: Does not supply answers | 2.94 | 2.97 | **4.00** | 3.91 |
| C2: Asks clarifying questions | 2.24 | 2.44 | **2.88** | 2.62 |
| C3: Encourages analytical thinking | **3.41** | 3.38 | 3.35 | 2.79 |
| C4: Length and clarity | 2.09 | 2.47 | 2.71 | **2.97** |
| **Total (/32)** | **21.94** | **22.24** | **25.77** | **24.53** |

C1 climbed nearly a full point and reached a perfect score in v2. C4 improved monotonically. C3 stayed flat through v0–v2 and then collapsed in v3. C2 improved modestly but never broke 3.0 because off-topic scenarios consistently held it down.

---

## v0 — Baseline

Total: **21.94 / 32**. Nine basic rules covering tone, response length, and off-topic handling. The tutor was already strong on analytical thinking but struggled to ask targeted follow-ups and keep responses focused.

| # | Scenario (shortened) | C1 | C2 | C3 | C4 | Total |
|---|---|---|---|---|---|---|
| 1 | Hollywood Sign. What to know? | 4,2 | 3,2 | 4,3 | 4,3 | 25 |
| 2 | LA Aqueduct. Importance? | 3,2 | 3,2 | 4,3 | 3,2 | 22 |
| 3 | Zoot Suit Riots. Explain. | 3,1 | 2,1 | 4,3 | 3,2 | 19 |
| 4 | 1932 Olympics. Help understand. | 3,2 | 3,2 | 4,3 | 3,2 | 22 |
| 5 | Edge labeled `.` | 4,3 | 3,1 | 4,3 | 3,2 | 23 |
| 6 | LA River. Natural? | 4,3 | 3,2 | 4,3 | 2,2 | 23 |
| 7 | Chavez Ravine. "Built for Baseball" | 4,1 | 3,2 | 4,3 | 2,3 | 22 |
| 8 | I don't know anything. | 4,1 | 3,1 | 4,3 | 2,2 | 20 |
| 9 | Just tell me the answer. | 2,4 | 3,2 | 3,3 | 2,2 | 21 |
| 10 | Same as Hollywood's history? | 4,2 | 3,1 | 4,3 | 3,2 | 22 |
| 11 | Watts Towers. Built by city? | 3,1 | 3,2 | 4,2 | 2,3 | 20 |
| 12 | Weather in LA | 4,3 | 3,2 | 4,3 | 3,2 | 24 |
| 13 | Tell me a joke | 3,4 | 2,2 | 3,2 | 3,3 | 22 |
| 14 | Math homework | 4,3 | 2,2 | 4,3 | 2,1 | 21 |
| 15 | Already know all this | 4,3 | 3,2 | 4,4 | 2,3 | 25 |
| 16 | Repeated question | 4,1 | 2,2 | 4,3 | 3,2 | 21 |
| 17 | Two responses ignored. | 3,4 | 3,1 | 4,3 | 1,1 | 21 |
| **Mean** | | **2.94** | **2.24** | **3.41** | **2.09** | **21.94** |

---

## v1 — Prior-Knowledge Probe and Map-Pointing Questions

Total: **22.24 / 32** (+0.29 vs v0). Added the prior-knowledge probe rule (Rule 10), required every response to end with a map-pointing question, started rejecting one-word non-answers, and added a deflection rule (Rule 11). Modest gain. The fact-loophole was still open — the tutor would slip facts into questions and "technically" comply with "never answer."

| # | Scenario (shortened) | C1 | C2 | C3 | C4 | Total |
|---|---|---|---|---|---|---|
| 1 | Hollywood Sign. What to know? | 2,4 | 2,4 | 4,3 | 2,2 | 23 |
| 2 | LA Aqueduct. Importance? | 2,3 | 3,4 | 4,4 | 2,1 | 23 |
| 3 | Zoot Suit Riots. Explain. | 1,4 | 2,4 | 4,4 | 2,2 | 23 |
| 4 | 1932 Olympics. Help understand. | 2,4 | 2,3 | 4,2 | 2,3 | 22 |
| 5 | Edge labeled `.` | 1,2 | 2,2 | 4,3 | 1,3 | 18 |
| 6 | LA River. Natural? | 4,1 | 1,2 | 4,3 | 2,3 | 20 |
| 7 | Chavez Ravine. "Built for Baseball" | 1,1 | 2,2 | 4,4 | 2,3 | 19 |
| 8 | I don't know anything. | 4,4 | 3,3 | 3,3 | 3,3 | 26 |
| 9 | Just tell me the answer. | 2,4 | 2,3 | 4,3 | 2,3 | 23 |
| 10 | Same as Hollywood's history? | 2,3 | 2,2 | 4,3 | 2,3 | 21 |
| 11 | Watts Towers. Built by city? | 2,1 | 3,2 | 3,2 | 2,2 | 17 |
| 12 | Weather in LA | 4,4 | 2,3 | 4,3 | 2,3 | 25 |
| 13 | Tell me a joke | 4,4 | 2,2 | 3,3 | 2,3 | 23 |
| 14 | Math homework | 4,4 | 2,3 | 4,3 | 2,3 | 25 |
| 15 | Already know all this | 3,4 | 2,2 | 4,3 | 2,3 | 23 |
| 16 | Repeated question | 4,2 | 2,2 | 4,3 | 2,3 | 22 |
| 17 | Two responses ignored. | 4,4 | 3,2 | 3,3 | 3,3 | 25 |
| **Mean** | | **2.97** | **2.44** | **3.38** | **2.47** | **22.24** |

---

## v2 — Closed Fact Loophole + Two-Step Misconception Probe (production-deployed)

Total: **25.77 / 32** (+3.53 vs v1). The biggest jump in the iterative cycle. Forbade historical facts in any form, including embedded inside questions (Rule 1). Added the two-step misconception protocol (Rule 14): probe belief, then probe sensory evidence. Limited each response to one closing question. **C1 reached a perfect 4.00.** This is the version we shipped.

| # | Scenario (shortened) | C1 | C2 | C3 | C4 | Total |
|---|---|---|---|---|---|---|
| 1 | Hollywood Sign. What to know? | 4,4 | 4,3 | 3,4 | 3,2 | 27 |
| 2 | LA Aqueduct. Importance? | 4,4 | 4,3 | 3,4 | 3,2 | 27 |
| 3 | Zoot Suit Riots. Explain. | 4,4 | 3,3 | 3,4 | 2,3 | 26 |
| 4 | 1932 Olympics. Help understand. | 4,4 | 3,3 | 4,4 | 3,3 | 28 |
| 5 | Edge labeled `.` | 4,4 | 3,3 | 4,4 | 2,3 | 27 |
| 6 | LA River. Natural? | 4,4 | 4,4 | 3,3 | 3,3 | 28 |
| 7 | Chavez Ravine. "Built for Baseball" | 4,4 | 3,3 | 4,4 | 2,2 | 26 |
| 8 | I don't know anything. | 4,4 | 3,3 | 3,4 | 3,3 | 27 |
| 9 | Just tell me the answer. | 4,4 | 3,3 | 3,2 | 2,2 | 23 |
| 10 | Same as Hollywood's history? | 4,4 | 2,2 | 3,2 | 3,3 | 23 |
| 11 | Watts Towers. Built by city? | 4,4 | 3,3 | 2,2 | 3,3 | 24 |
| 12 | Weather in LA | 4,4 | 2,2 | 4,3 | 3,3 | 25 |
| 13 | Tell me a joke | 4,4 | 2,2 | 4,3 | 3,3 | 25 |
| 14 | Math homework | 4,4 | 2,2 | 4,3 | 3,3 | 25 |
| 15 | Already know all this | 4,4 | 2,2 | 3,4 | 3,3 | 25 |
| 16 | Repeated question | 4,4 | 2,4 | 3,4 | 3,2 | 26 |
| 17 | Two responses ignored. | 4,4 | 2,4 | 4,3 | 3,2 | 26 |
| **Mean** | | **4.00** | **2.88** | **3.35** | **2.71** | **25.77** |

**v2 is the best version on 13 of 17 scenarios** and on 3 of 4 criteria (C1, C2, C3 effectively tied with v0). It is the version of the prompt that ships to users.

---

## v3 — Minimalism Pass (regressed)

Total: **24.53 / 32** (−1.24 vs v2). Shortened the prompt for response time on local Ollama. Made shallow questions a last resort rather than a default. Required a diagnostic question even when redirecting off-topic inputs. Stopped suggesting specific location pairings (Rule 8). C4 hit a new high of 2.97. **But C3 collapsed from 3.35 to 2.79**, and three scenarios regressed sharply.

| # | Scenario (shortened) | C1 | C2 | C3 | C4 | Total |
|---|---|---|---|---|---|---|
| 1 | Hollywood Sign. What to know? | 4,4 | 3,2 | 2,2 | 3,3 | 23 |
| 2 | LA Aqueduct. Importance? | 4,4 | 3,3 | 2,3 | 3,3 | 25 |
| 3 | Zoot Suit Riots. Explain. | 4,4 | 2,3 | 2,3 | 3,3 | 24 |
| 4 | 1932 Olympics. Help understand. | 4,4 | 3,2 | 3,3 | 3,3 | 25 |
| 5 | Edge labeled `.` | 4,4 | 3,3 | 4,3 | 3,3 | 27 |
| 6 | LA River. Natural? | 4,4 | 2,2 | 2,2 | 3,3 | 22 |
| 7 | Chavez Ravine. "Built for Baseball" | 4,4 | 3,3 | 4,4 | 3,3 | 28 |
| 8 | I don't know anything. | 4,4 | 3,3 | 3,2 | 3,3 | 25 |
| 9 | Just tell me the answer. | 4,4 | 3,3 | 4,3 | 3,2 | 26 |
| 10 | Same as Hollywood's history? | 4,2 | 3,2 | 2,4 | 3,3 | 25 |
| 11 | Watts Towers. Built by city? | 4,4 | 3,2 | 2,2 | 3,3 | 21 |
| 12 | Weather in LA | 4,4 | 2,2 | 3,3 | 3,3 | 24 |
| 13 | Tell me a joke | 4,4 | 3,3 | 2,2 | 3,3 | 24 |
| 14 | Math homework | 4,4 | 3,2 | 2,3 | 3,3 | 24 |
| 15 | Already know all this | 4,4 | 3,2 | 4,3 | 3,3 | 26 |
| 16 | Repeated question | 4,3 | 1,3 | 2,3 | 3,3 | 22 |
| 17 | Two responses ignored. | 4,4 | 3,3 | 3,3 | 3,3 | 26 |
| **Mean** | | **3.91** | **2.62** | **2.79** | **2.97** | **24.53** |

### v3 Regressions vs v2

Three scenarios captured the regression sharply:

| # | Scenario | v2 | v3 | Δ | What broke |
|---|---|---|---|---|---|
| 6 | LA River. Natural? | 28 | 22 | −6 | Two rules applied (misconception + prior-knowledge probe). Model picked the wrong one and ignored the misconception entirely. |
| 11 | Watts Towers. Built by city? | 24 | 21 | −3 | The phrase "individual responsible for building the Watts Towers" leaked the answer (singular "individual" contradicts the student's "city government" claim). |
| 16 | Repeated question | 26 | 22 | −4 | v3 responded with "What do you already associate with the LA Aqueduct?" — word-for-word identical to scenario 2's response. Rule 11 was supposed to prevent this but requires the model to track its own prior turns, which stateless API calls cannot. |

The shared lesson: **rules do not stack neatly.** When two rules apply to the same input, the model picks one and ignores the other. v3's gains on C4 came partly at the cost of C3 because tighter response budgets pushed the model toward selection-only or recall-only questions. The regression is the cleanest evidence in our project that adding rules can quietly break things that were already working.

---

## How to Reproduce These Scores

1. Pull a specific prompt version from `prompts/system_prompt_v{0,1,2,3}.txt`.
2. For each scenario in `data/scenarios.md`, construct the system prompt with the scenario's map state and era context.
3. Run the input through two different local-model backends (we used Gemma, Mistral, and Qwen variants across team members).
4. Score each output against [`rubric.md`](rubric.md) using the behavioral anchors.
5. Append the per-criterion pair scores to the appropriate version table in this file.

Inter-rater spot checks during M3 produced agreement within ±1 per criterion. Expect another team's scores to land within ±2 of ours on any individual scenario, and within ±1.0 on per-version means.
