# User Testing Protocol

This document is the protocol used for all user testing sessions of LA History. It is referenced from the M3 and M4 milestones and was the script all observers followed during the four sessions documented in [`user_testing_notes.md`](user_testing_notes.md).

## Session Goal

Observe how a target-persona learner interacts with LA History without prior coaching. The protocol is designed to surface usability problems, gaps in pedagogical guidance, and points where the AI tutor's Socratic design either succeeds or fails.

## Participants

### Recruitment Criteria

- High school or college age (18+ for consent reasons)
- Interested in learning about Los Angeles history
- Not a member of the project team
- Mix of LA-native and non-LA participants (the application targets non-natives, but native participants surface assumptions the design takes for granted)

### Sample Size

Minimum four participants per the course requirement. Aim for representation across:
- LA-native vs. non-LA-native (at least one of each)
- Year in school (mix of underclassmen and upperclassmen if possible)
- Comfort with technology (avoid only recruiting CS-majors)

### Consent

All participants are 18+ adults who have provided written consent before the session. The consent form is administered through Google Forms. **Do not record audio or video without separate written consent.** No personally identifying information is retained in session notes — participants are anonymized as P1, P2, etc., in the analysis.

---

## Pre-Session Setup

### Environment

- Quiet room with a laptop or desktop computer (the participant may use their own device if preferred and the app is set up on it).
- The application running locally with the most recent prompt version committed to `main`.
- Screen visible to the observer.
- No other people present besides the participant and 1–2 observers.
- Pen and paper or a separate device for note-taking — observers should not type into the laptop the participant is using.

### Account Pre-Created (Optional)

If the participant prefers not to create an account with a real email, an observer-created test account is available. Note this choice in the session notes.

---

## Verbal Introduction (Read Aloud)

Read the following to the participant verbatim before starting:

> "We're testing a history learning app, not testing you. There are no right or wrong answers. Please think out loud as you go — say whatever is on your mind, even if it seems obvious. We won't help you unless you get completely stuck on a technical issue. We want to see what the app does, not what we think it should do."

### What NOT to Say

- Do **not** explain how the AI tutor is supposed to behave.
- Do **not** mention "Socratic," "concept map," or "constructivism" before the participant encounters these features themselves.
- Do **not** describe the era-unlock progression in advance.
- Do **not** answer "what is this for?" beyond saying "it's a history learning app."

The point is to see how the application teaches itself to a fresh user.

---

## Tasks

Tasks are given in order, read verbatim, and not supplemented with examples, hints, or clarifications unless the participant is blocked by a login or technical error (not by confusion about the task itself — that confusion is data).

### Task 1 — Explore and Visit

> "This is an app about Los Angeles history. Take a few minutes to look around and visit any locations that interest you. There's no wrong place to start."

**What to observe:**
- How they navigate the map (panning, zooming, clicking).
- Whether they read location descriptions or skim them.
- How they respond to the era-lock system (frustration, curiosity, confusion).
- Whether the UI feels intuitive without instructions.
- Whether they discover the quiz flow on their own.

**Time:** ~5–8 minutes.

### Task 2 — Build the Concept Map

> "You should see a Concept Map tool for the era you've unlocked. Open it and try to build a map that shows how the places you visited are connected. Use the chat panel on the right side if you want."

**What to observe:**
- Whether they use the chat panel unprompted or ignore it entirely.
- How they respond to the tutor's questions (engaged / one-word / dismissive).
- Whether they add edges or only nodes.
- What labels they write for their edges (specific vs. vague).
- Whether they ask the observer for help (and what they ask for).

**Time:** ~7–10 minutes.

### Task 3 — Get Help from the AI

> "Ask the chat panel something about the era you're working on — whatever is on your mind about the map or the history."

**What to observe:**
- What they ask (recall question / connection question / random / off-topic).
- Whether the tutor's response makes sense to them.
- Whether they follow up or disengage.
- Whether they express frustration, surprise, or boredom.
- Whether they treat the tutor like a search engine, a chatbot, or a teacher.

**Time:** ~5–7 minutes.

---

## Think-Aloud Prompts

Use these only when the participant goes silent for more than 30 seconds:

- "What are you thinking right now?"
- "What did you expect to happen when you clicked that?"
- "Was that response helpful? Why or why not?"
- "What were you hoping to find?"

Avoid leading questions like "Did you find that confusing?" — instead ask "What did you think of that?"

---

## Intervention Rules (Emergency Only)

Intervene only if the application crashes, blocks the participant from continuing, or returns a completely nonsensical AI response. In those cases say:

> "That's a bug — our fault. Let me refresh, and you can continue."

Do **not** intervene when the participant is confused about how to use a feature. Confusion is the data we are collecting.

---

## Exit Questionnaire

Administered verbally after Task 3. The observer takes notes; the participant does not need to fill out a form.

1. **Helpfulness.** "On a scale of 1 to 5, how helpful did you find the AI chat panel while building the concept map? (1 = not helpful at all, 5 = very helpful) Why did you give it that number?"
2. **Confusion points.** "Was there any moment where you weren't sure what the app wanted you to do, or where the AI's response didn't make sense? Describe what happened."
3. **One change.** "If you could change one thing about the AI tutor, what would it be?"
4. **Overall.** "Is there anything else you want to say about the experience?"

---

## Post-Session Analysis

After the session, the observer should:

1. Within 24 hours, write up the session notes in `user_testing_notes.md` under a `## Participant N` heading. Anonymize the participant.
2. Tag the notes with at least one of these themes if applicable: `tutorial-confusion`, `chat-underuse`, `edge-direction`, `quiz-pacing`, `unsolicited-feature-request`, `lock-system`.
3. After all sessions are complete, identify at least **two patterns across participants** (the M4 requirement) and write at least **one design change** that responds to those patterns. Document both in the final report.

---

## What Counts as a Pattern

A pattern is a behavior or reaction observed in **at least 3 of 4 participants**, or in 2 of 4 participants if the behavior was strongly stated. A single participant's complaint, however vivid, is feedback — not a pattern.

Examples of patterns we have observed in past sessions:
- 3+ participants did not use the AI chatbot until prompted.
- 3+ participants assumed concept-map edges were bidirectional.
- 2+ participants explicitly asked for a "browse mode" with no quizzes or unlocks.

---

## Session Logistics Checklist

Before the session:
- [ ] Application running and reachable on `localhost`
- [ ] Most recent prompt version pulled from `main`
- [ ] Test account ready (if needed)
- [ ] Note-taking surface ready (separate device or paper)
- [ ] Consent form signed
- [ ] Quiet room confirmed

During the session:
- [ ] Read the verbal introduction verbatim
- [ ] Read each task verbatim
- [ ] Note timestamps for major events (first tutor message, first edge added, first frustration, etc.)
- [ ] Resist intervening except for crashes or hard blocks
- [ ] Administer exit questionnaire after Task 3

After the session:
- [ ] Write up notes within 24 hours
- [ ] Anonymize the participant
- [ ] Tag with theme labels
- [ ] Once 4+ sessions complete, identify patterns and propose changes
