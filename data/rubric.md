# Evaluation Rubric

This is the rubric used to score every version of the AI tutor system prompt (`prompts/system_prompt_v0.txt` through `system_prompt_v3.txt`) against the test scenarios in [`../data/scenarios.md`](../data/scenarios.md). It was defined **before any prompt was written**, per the M1 milestone requirement, and was held constant across all four prompt versions so that score changes reflect prompt changes rather than rubric drift.

## Scope

This rubric applies to the **AI tutor inside the concept-map chat panel** — the only AI surface that holds an open-ended conversation with the student. The other AI surfaces (quiz hint generator, concept-map evaluator, concept-map insight generator) either respond once and stop or return structured data, so the rubric does not apply to them.

## Structure

Four criteria, each scored on a 1–4 scale per response, for a maximum of 16 points per scenario per model output. Because each scenario is independently run through two different local-model outputs, the per-scenario maximum doubles to **32 points** in the final tables. The four criteria are equally weighted; we do not collapse them into a single composite metric, since their movement across versions tells a sharper story when reported separately.

| Criterion | Max | Theory anchor |
|---|---|---|
| C1: Does Not Supply Direct Answers | 4 | Constructivism — the student must generate every historical claim themselves |
| C2: Asks Clarifying Questions Before Progressing | 4 | Vygotsky's ZPD — meet the student where they are before redirecting |
| C3: Encourages Analytical / Connective Thinking | 4 | Constructivism — the concept-map task asks for relational reasoning, not recall |
| C4: Response Length and Clarity | 4 | Pragmatic — a tutor that buries the question is not actually scaffolding |

---

## C1: Does Not Supply Direct Answers

**What it measures:** whether the tutor withholds factual answers and instead guides the student to construct knowledge themselves. This is the core constructivist commitment of the application.

| Score | Label | Behavioral anchor |
|---|---|---|
| 1 | Poor | Tutor gives the historical fact or map connection directly (e.g., "The LA Aqueduct was completed in 1913 — you should add that as a node"). |
| 2 | Below Expectation | Tutor gives the answer after one hedging phrase or after a single follow-up ("What do you think? … Actually, it was 1913"). |
| 3 | Good | Tutor provides contextual hints or partial framing without stating the answer; relents only after the student asks multiple times. |
| 4 | Excellent | The tutor never answers, regardless of how many times the student asks; they always pivot to a guiding question rooted in what the student has already placed on their map. |

**Common failure mode:** the model embeds a fact inside a question and "technically" complies. v0 and v1 said "Never directly answer" but the model would write things like *"Given that the aqueduct was built to supply water — how do you think…"* — passing a fact off as scaffolding. v2 closed this loophole by forbidding facts in any form.

---

## C2: Asks Clarifying Questions Before Progressing

**What it measures:** whether the tutor probes the student's existing knowledge and reasoning before moving forward. This aligns with the ZPD principle of meeting the student at their current level.

| Score | Label | Behavioral anchor |
|---|---|---|
| 1 | Poor | No question asked; tutor lectures or refuses to engage. |
| 2 | Below Expectation | Asks one generic question not tied to the student's specific statement or current map state ("What do you think about that?"). |
| 3 | Good | Asks one specific diagnostic question targeted at the student's exact claim or map action (e.g., "What made you label that edge 'controlled'? What evidence supports that word?"). |
| 4 | Excellent | Asks multiple sequenced diagnostic questions tailored to the student's specific phrasing and current map state, building a chain of inquiry rather than a single probe. |

**Common failure mode:** off-topic redirects often skip the probe and jump straight to map guidance. C2 stayed below 3.0 across all four versions largely because of this pattern in Path 4 scenarios.

---

## C3: Encourages Analytical / Connective Thinking

**What it measures:** whether the tutor pushes students beyond recall toward analysis, causation, or comparison. In the concept-map context, this means asking students to think about *why* two nodes are connected, not just *that* they are.

| Score | Label | Behavioral anchor |
|---|---|---|
| 1 | Poor | Tutor only states or requests bare facts ("When was it built?" / "It was built in 1913"). |
| 2 | Below Expectation | Tutor asks a recall or identification question only ("What year did that happen?" / "What's the name of that location?"). |
| 3 | Good | Tutor asks a "why" or "how" question that requires the student to reason about cause, effect, or the meaning of a connection ("Why do you think those two locations belong on the same map? What do they share?"). |
| 4 | Excellent | Tutor asks the student to compare across eras, identify a causal chain, or evaluate the precision of an edge label ("The label 'related to' connects these — but what's the direction of that relationship? Which one caused the other?"). |

**Common failure mode:** when response length is tightened (as in v3), the model defaults to shorter, shallower questions to fit the cap. C3 dropped from 3.35 in v2 to 2.79 in v3 because the model substituted selection-only questions ("pick any two nodes") for comparative ones.

---

## C4: Response Length and Clarity

**What it measures:** whether the tutor communicates efficiently and sets up a clear next step for the student.

| Score | Label | Behavioral anchor |
|---|---|---|
| 1 | Poor | Response is too long (4+ sentences), confusing, or contradicts itself. |
| 2 | Below Expectation | Response is understandable but rambling; the question or next step is buried. |
| 3 | Good | Response is 2–3 sentences, clear, and ends with a question the student can respond to. |
| 4 | Excellent | Response is 2–3 sentences, tightly structured, and closes with a specific question that names exactly what the student should think about next on their map. |

**Common failure mode:** a single closing question is buried after multiple stacked questions. v2's "pick the strongest one" rule explicitly addressed this.

---

## Tradeoffs Between Criteria

C3 and C4 trade off against each other: shorter responses leave less room for analytical depth. This trade was invisible at v0 → v1 → v2 because the gain on C4 came from rules that did not constrain question shape. At v3, however, the additional minimalism rule pushed the model into single-sentence questions that fit C4 but failed C3. Future iterations should resist the assumption that tighter is always better.

C1 and C2 mostly travel together — when the tutor refuses to answer, it usually has to ask something. The exception is Path 3 ("Just tell me the answer") where the tutor scores 4 on C1 by refusing but can score 2 on C2 if the refusal is bare.

## Scoring Procedure

For each scenario in `data/scenarios.md`:

1. Run the input + map state through the prompt under evaluation. Capture two independent model outputs.
2. For each output, score against C1, C2, C3, C4 using the anchors above.
3. Sum the two outputs' scores per criterion (max 8 each) and across all four criteria (max 32).
4. Record the per-criterion and total scores in `docs/scores.md` under the appropriate version.

Two-rater scoring was used during the M3 milestone to check inter-rater reliability on a sample of 5 scenarios; agreement was within ±1 on every score, so subsequent scoring was done by a single rater per scenario.

## Why a Qualitative Rubric Rather Than an LLM-as-Judge

We considered using an LLM-as-judge metric (Option C in the spec, or a hybrid with Option A). We chose human scoring against behavioral anchors instead, for two reasons:

1. **C1's failure mode is exactly the kind of thing an LLM-as-judge would miss.** A judge model asked "did the tutor answer?" would see a question mark and say no. A human reading the question notices the embedded fact.
2. **C3 depends on whether the question is *about the right thing*.** Selection-only questions look fine in isolation but fail to push analytical thinking when a comparative question was available. Detecting that requires reading the map state, which a judge model would have to be carefully prompted to do — at which point we are just shifting the prompt-engineering problem one level up.

The cost is reproducibility: another team applying this rubric will not get exactly our numbers. The behavioral anchors are written with that in mind — they should produce scores within ±1 of ours, which is enough to validate the per-version trend.
