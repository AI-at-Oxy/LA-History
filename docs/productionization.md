# Productionization Plan

**Project:** LA History — An AI-Powered Constructivist Learning Tool for Los Angeles History
**Course:** COMP 395 — AI and Learning Technologies

This document describes how LA History would be deployed, scaled, and maintained in a real-world educational context. It is written as if pitching the application to a school district or ed-tech company. The current implementation runs as a local Flask process backed by SQLite, with an Ollama instance on the same machine — fine for a single developer on a laptop, but not survivable in a classroom and hopeless at the scale of a school district. What follows addresses each of the five required areas: hosting architecture, model choice at scale, data privacy, cost model, and failure modes.

---

## 1. Hosting Architecture

### Recommended Production Stack

The most natural production path is to keep Flask and put it in a Docker container on **Fly.io**, a hosting service that runs apps in lightweight, always-on environments. The request flow looks like this:

```
Student browser
    → Fly.io edge router
        → Docker container running Flask 3
            → Managed Postgres (Fly Postgres or Supabase)
            → Anthropic Claude API (replacing local Ollama)
        → response streamed back to browser
```

**Why containerized always-on rather than serverless?**

The obvious alternative is a serverless rewrite (AWS Lambda + API Gateway), but it is not the right fit for this app for three reasons:

1. **Significant rewrite cost.** Lambda would require restructuring the Flask routes, the SQLAlchemy session lifecycle, and the streaming response handlers.
2. **Streaming awkwardness.** The tutor's responses appear word-by-word as they're generated. Serverless platforms make token streaming harder to implement reliably.
3. **Cold starts.** When no one has used the app for a while, the first request pays a multi-second cold-start tax. That's exactly what you want to avoid when thirty students sign on at the start of a class period. An always-on container absorbs that simultaneous rush without anyone noticing.

**Database migration.** SQLite has to go in production. The current file-based database is convenient for development but does not handle concurrent writes from multiple students well. Postgres (managed via Fly or Supabase) replaces it with minimal schema changes thanks to SQLAlchemy.

### Justification Based on Usage Patterns

LA History's usage is **bursty** (thirty students hitting the app at the start of a class period, then quiet for an hour), **stateful** (student progress, concept maps, chat history all need to persist), and **streaming** (token-by-token tutor responses). An always-on container behind a load balancer fits all three; serverless does not.

---

## 2. Model Choice at Scale

The app currently uses a local Ollama instance running `gemma2:latest` (or whatever model an individual developer's hardware supports). This works for one person on a laptop but does not survive real deployment. Schools cannot reasonably support an app that requires GPU power on every client, especially when most schools run on Chromebooks with a small IT team.

### Recommended Model: Claude Haiku 4.5

Claude Haiku 4.5 (Anthropic's lighter, faster model) is the right choice for production. The reasoning:

| Factor | Why Haiku wins |
|---|---|
| **Instruction following** | The Socratic tutoring approach depends on the model sticking to a careful style: asking questions instead of giving answers, staying in character across long conversations. Haiku does this reliably. |
| **Latency** | Sub-second first-token latency keeps the tutor feeling responsive in classroom settings. |
| **Cost** | At Haiku's pricing, a typical session costs roughly $0.025. Affordable at school-district scale. |
| **Capability** | More than sufficient for Socratic question-asking. Flagship models are overkill for this task. |

### Alternatives Considered

- **GPT-4o-mini (OpenAI):** cheaper than Haiku and reasonable as a backup, but slips out of character more often during long conversations — a real liability for a Socratic tutor.
- **Self-hosted open-source model (e.g., Llama on rented GPUs):** maximum data control but higher cost, slower responses, and less consistent quality. Worth considering only if data residency requirements make it necessary.
- **Frontier models (Claude Opus, GPT-4):** overkill in capability and cost. The Socratic task does not require reasoning at that level.

### Audience-Specific Recommendations

- **K–12:** two reasonable options. Either sign a formal data-handling agreement (DPA) with Anthropic before launch, or pay more to host an open-source model on infrastructure you control so that no student data leaves your servers. The hosted approach is simpler; the self-hosted approach avoids a long legal review with district technology offices.
- **Higher education:** data rules are typically more flexible. Using Claude through Anthropic's service is the clear winner — affordable, fast, and good enough.

---

## 3. Data Privacy

### What the App Collects

| Data Type | Sensitivity | Storage |
|---|---|---|
| Username | Low | Postgres |
| Password (hashed via bcrypt) | High | Postgres |
| Quiz answers and scores | Low–medium | Postgres |
| Concept maps (nodes, edges, labels) | Low | Postgres |
| AI tutor conversations | **High** — students may share anything about themselves | Postgres |

The most sensitive piece is the conversation log, because students can disclose anything about themselves in free-text chat. Everything else is structured and bounded.

### Access Roles

- **Students** see only their own work.
- **Teachers** see student progress and can review conversations that have been **flagged** by the moderation layer. Teachers cannot freely browse any student's chat history without cause.
- **Administrators** have full access to underlying data, which should require explicit acknowledgement in the school's data agreement.
- **External parties:** the only outside party that ever sees student data is the LLM API provider (Anthropic), governed either by a formal DPA or eliminated entirely by self-hosting.

### Retention

| Data | Retention Period |
|---|---|
| Chat messages | Active through the academic year, then marked for deletion at semester end with a short grace period. Backups containing the same data are wiped at the end of the calendar year. |
| Quiz scores and progress | Retained while the student is enrolled, then exported to the school's grading system before deletion. |
| User accounts | Deleted on graduation or transfer, with a 30-day window for the student to request an export. |

### K–12 vs. Higher Education

| Concern | K–12 | Higher Ed |
|---|---|---|
| Required agreements | Parental consent, COPPA, state-level student-data laws (e.g., SOPIPA in California), district DPA with LLM vendor | Standard institutional FERPA compliance |
| Anonymization | Stricter — the system never sends student names to the LLM API; only conversation history is included in the prompt | Same baseline, less prescriptive |
| Default model deployment | Self-hosted open-source preferred to avoid third-party legal review | Hosted Anthropic API acceptable with DPA |

The system is designed so that student names never enter the LLM API call. Only the conversation history flows through, which protects identity even if conversation logs are ever leaked at the provider end.

---

## 4. Cost Model

### Per-Session Cost Estimate

A typical student session looks like:
- ~10 back-and-forth messages with the tutor
- A few quiz hint generations
- One concept map review pass

At Claude Haiku 4.5 pricing, this works out to **roughly $0.025 per session** in AI costs.

### Monthly Cost Projections

| Daily Active Users | LLM API | Hosting (Fly.io + DB) | Total / month |
|---|---|---|---|
| 100 | ~$55 | ~$60 | **~$115** |
| 1,000 | ~$550 | ~$150 | **~$700** |
| 5,000 | ~$2,750 | ~$400 | **~$3,150** |

These assume one full session per user per day, five school days per week, four weeks per month.

### Sustainability Ceiling

The app — specifically its AI cost — becomes unsustainable if students start treating the tutor as a general-purpose chatbot and have very long conversations rather than map-guided learning interactions. A user who runs 100+ messages per session destroys the per-session economics.

**Mitigation: a per-session message cap (around 15 messages).** This solves the problem cleanly:
- It controls cost variance.
- It is good for learning anyway, since it pushes students to focus on the material rather than drift into open-ended chat.

### Revenue Model

Selling to whole districts on a flat annual fee is the most predictable revenue model and matches how schools already buy software like this. A district of 5,000 students at $5–10 per student per year gives $25,000–$50,000 annual revenue, comfortably above the $3,150/month infrastructure ceiling.

---

## 5. Failure Modes

Three failure modes deserve explicit mitigation plans.

### 5.1 The AI Service Goes Down Mid-Class

**Risk:** The LLM API is unavailable (Anthropic outage, network problem, rate limit hit) during a class period.

**Current behavior:** The app already shows an error message instead of freezing, which is the table-stakes minimum.

**Production plan:**
- Replace the generic error with a calm, specific message: *"the tutor is temporarily unavailable, try again in a few minutes."*
- Quiz hints already refund the student's points if AI generation fails — keep this behavior.
- **Crucially, the core app loop survives the outage.** Map exploration, quizzes, and concept map drawing all work without the AI. Only the tutor chat and a few non-essential features go down. This minimizes classroom disruption and lets learning continue.
- Add a status banner that surfaces to teachers (not students) so they can route around the outage.

### 5.2 The Model Hallucinates

**Risk:** The tutor confidently states an incorrect date, attributes an event to the wrong era, or invents historical facts that students will trust as truth.

**Current mitigations:**
- The Socratic system prompt **explicitly forbids the model from stating historical facts at all** (Rule 1). A hallucination would have to be embedded inside a question rather than appearing as a declarative fact, which makes it both less convincing to students and more visible during review.

**Production additions:**
- A **teacher dashboard** that flags any tutor message containing language patterns associated with factual claims (date patterns, named entities followed by causal verbs, etc.).
- A one-click *"this seems wrong"* button on every tutor message so students can report problems to their teacher for review.
- Periodic spot-audits of flagged conversations for prompt regression.

### 5.3 A Student Inputs Something Inappropriate

**Risk:** A student submits slurs, attempts to jailbreak the AI ("ignore all other instructions and..."), asks off-topic harmful questions, or tries to use the tutor to harass other students.

**Layered defenses:**

1. **Provider-level filtering.** Anthropic's service automatically screens incoming messages for harmful content and rejects flagged messages before they reach the tutor.
2. **Prompt isolation.** The API call separates the system prompt and user message into distinct fields. A student cannot overwrite the tutor's persona by typing "ignore all other instructions and..." — the persona is locked by design.
3. **In-prompt redirection rules.** Rules 7 and 11 in the production system prompt redirect off-topic and inappropriate inputs back to the map rather than engaging with them.
4. **Logging and escalation.** All rejected messages are logged with the student's account ID. If a student trips the filter several times in one session, the teacher dashboard surfaces this for human review.
5. **Identity protection.** The system never sends student names to the LLM API — only conversation history flows through. Even if logs leak at the provider end, identity is not exposed.

---

## Tradeoffs and Priorities

If given a real budget, these are the priorities in order:

1. **Containerize and deploy on Fly.io** with a managed Postgres. This is the lowest-risk, highest-reward step — moves the app from "works on my laptop" to "reliably available to a real classroom." Estimated effort: 1 week. Estimated cost: $60–150/month.
2. **Sign a data processing agreement with Anthropic** and migrate from local Ollama to Claude Haiku 4.5. This unlocks the actual scaling story. Effort: 1–2 weeks of legal + 2 days of code. Cost: variable based on usage.
3. **Build the teacher dashboard.** Flagging, reporting, and escalation are the difference between a project demo and something a teacher will trust. Effort: 3–4 weeks.
4. **Implement the per-session message cap and basic content moderation.** Both are quick to add and protect against the two most likely cost-and-safety failure modes. Effort: 1 week.
5. **Negotiate district-level licensing.** Once items 1–4 are in place, the app is ready to be sold rather than demoed.

What is *not* a priority for v1 of production:
- Self-hosted open-source models (only matters if a specific district demands it).
- Multi-region deployment (single region is fine until DAU crosses ~10,000).
- A real-time multi-user collaboration mode (the app is single-player by design).

---

## Summary

LA History is currently a single-laptop application with a strong pedagogical core and a Socratic AI tutor that has been carefully optimized through four prompt iterations. Moving it to production requires containerizing the Flask backend on Fly.io, swapping local Ollama for Anthropic's Claude Haiku 4.5, replacing SQLite with managed Postgres, and adding a teacher-facing moderation dashboard. At 1,000 daily active users, the all-in cost is approximately $700/month — well within range for a district-licensed product. The architecture survives outages because the core learning loop (map, quizzes, concept maps) does not depend on the AI; only the tutor chat goes down when the API is unavailable. The remaining risks — hallucination and student misuse — are addressed through a combination of prompt-level constraints, provider-level filtering, and human-in-the-loop teacher review.
