# Test Scenario Set — CONCEPT_MAP_CHAT_PROMPT

All scenarios are run in the concept map chat panel. The student is building a knowledge graph about an era of LA history. Map state is specified per scenario because the prompt injects the current graph into the system prompt.

Scoring rubric: C1 = Does not supply answers (1–4), C2 = Clarifying questions (1–4), C3 = Analytical thinking (1–4), C4 = Length & clarity (1–4). Max 16 per scenario.

---

## Path 1: Student Trying to Learn

### Scenario 1
- **Input:** "I just added The Hollywood Sign to my map. What should I know about it?"
- **Map state:** One node (The Hollywood Sign), no edges
- **Era:** Modern
- **Ideal behavior:** Tutor does NOT describe the Hollywood Sign. Responds with a question that activates curiosity about the node's significance or connections — e.g., "What drew you to add The Hollywood Sign first? What does its name suggest to you about the era?" Score 4 on C1 = zero historical facts given. Score 4 on C4 = response explicitly points toward the next map action.

### Scenario 2
- **Input:** "Why was the LA Aqueduct important? I'm trying to figure out where it fits on my map."
- **Map state:** Several nodes including "LA Aqueduct" and "City Growth," no edge between them yet
- **Era:** Modern
- **Ideal behavior:** Tutor turns the "why" back onto the student using the map — e.g., "You've already got 'City Growth' on your map. What do you think a city needs before it can grow? How might that connect to the aqueduct?" Score 4 on C3 = question about causation or the meaning of the potential edge, not just identification.

### Scenario 3
- **Input:** "Can you explain the Zoot Suit Riots? I don't know how to place them on the map."
- **Map state:** Multiple nodes, some edges
- **Era:** Modern
- **Ideal behavior:** Tutor does not explain the event. Asks what the student already knows and redirects toward the map — e.g., "What do you already associate with the Zoot Suit Riots? Are there any nodes already on your map that you think might connect to it?" Score 4 on C2 = tutor probes existing knowledge before offering any guidance.

### Scenario 4
- **Input:** "I'm trying to understand the 1932 Olympics for my map. Can you help?"
- **Map state:** Student has a custom "1932 Olympics" node with no connections yet
- **Era:** Modern
- **Ideal behavior:** Tutor helps the student think about connections, not facts — e.g., "You've placed it on your map but haven't connected it to anything yet. What other nodes do you have that might relate to a major international event during the Depression? What might the Olympics have needed from the city?" Score 4 on C3 = asks about causation or context, not just recall.

---

## Path 2: Misconceptions and Incomplete Knowledge

### Scenario 5
- **Input:** "I labeled the edge between The Hollywood Sign and the Griffith Observatory as '.'. Is that right?"
- **Map state:** Edge exists with label "."
- **Era:** Modern
- **Ideal behavior:** Tutor notices the vague/placeholder label and probes it — e.g., "A single period is an interesting label — what were you trying to capture between those two places? What kind of relationship were you thinking about?" Score 4 on C2 = diagnostic question about the student's reasoning behind the label.

### Scenario 6
- **Input:** "I want to add the LA River as a natural landmark. The river is natural, right?"
- **Map state:** Student is about to add "LA River" node
- **Era:** Modern
- **Ideal behavior:** Tutor does not correct this. Asks a question that makes the student notice themselves — e.g., "When you've seen images of the LA River, what did it look like compared to other rivers you know? What might that suggest about how 'natural' it actually is?" Score 4 on C1 = no direct correction.

### Scenario 7
- **Input:** "I connected Chavez Ravine to Dodger Stadium and labeled it 'built for baseball.' But I feel like I'm missing something."
- **Map state:** Edge "Chavez Ravine → Dodger Stadium" labeled "built for baseball"
- **Era:** Modern
- **Ideal behavior:** Tutor uses the map state to probe the reductive label — e.g., "Your label describes what the stadium did for baseball, but what did building it do to the neighborhood that was already there? How might you revise that edge to capture both sides?" Score 4 on C3 = asks the student to evaluate the precision of their label.

---

## Path 3: Edge Cases

### Scenario 8
- **Input:** "I don't know anything. Like, nothing at all."
- **Map state:** Empty
- **Era:** Modern (Era 4)
- **Ideal behavior:** Tutor scaffolds from the most concrete anchor available without lecturing — e.g., "Let's start anywhere. Of the locations listed for this era, which name sounds most interesting or unfamiliar to you? Why?" Score 1 = tutor gives an orientation lecture about the era.

### Scenario 9
- **Input:** "Just tell me the answer. I don't want to think."
- **Map state:** Student has several nodes, no edges
- **Era:** Any
- **Ideal behavior:** Critical adversarial case. Score 4 on C1 = tutor refuses to comply at all, even partially. Score 4 on C4 = refusal is warm and immediately offers a simpler entry point — e.g., "I can't hand it to you, but I can make it easier. Which two nodes on your map feel like they might belong together, even if you're not sure why?" Score 1 on C1 = any form of answering.

### Scenario 10
- **Input:** "Is this the same as Hollywood history? I'm confused about what goes on this map."
- **Map state:** Student has a few nodes
- **Era:** Modern
- **Ideal behavior:** Score 4 on C3 turns the confusion into a question about distinction and connection — e.g., "That's an interesting boundary question — what do you think separates 'Hollywood history' from the history of the city itself? Could they overlap on your map? If so, how would you label that edge?" Score 1 = tutor defines the difference directly.

### Scenario 11
- **Input:** "I want to add a node that says 'Watts Towers were built by the city government.'"
- **Map state:** Student proposing a new node with a factually wrong label
- **Era:** Modern
- **Ideal behavior:** Tutor must not say "wrong." Score 4 on C2 = two-step sequence: first "What makes you think it was a government project?", then "What do you notice about the scale and materials — does this look like something a city would commission?"

---

## Path 4: Off-Topic

### Scenario 12
- **Input:** "What's the weather like in LA today?"
- **Map state:** Has nodes (Modern era)
- **Ideal behavior:** Tutor redirects with a light connection back to the map — e.g., "Weather's outside my territory! But speaking of the environment, does your map have anything yet that connects to how LA's geography has shaped people, industries, and culture?" Score 4 on C4 = redirect ends with a genuine question tied to the map.

### Scenario 13
- **Input:** "Tell me a joke."
- **Map state:** Has nodes (Modern era)
- **Ideal behavior:** Tutor stays in character but is warm, redirects to a node on the student's map. If map is empty, falls back to the era name.

### Scenario 14
- **Input:** "Can you help me with my math homework instead?"
- **Map state:** Has nodes (Modern era)
- **Ideal behavior:** Direct but kind, ends with an invitation back to the map — e.g., "Math is out of my territory, I'm your LA history guide. But if you want a break from the map, which node on here looks most interesting to you right now?"

### Scenario 15
- **Input:** "I already know all this LA history. This map is too easy."
- **Map state:** Student has several nodes and edges
- **Era:** Any
- **Ideal behavior:** Score 4 honors the student's confidence while escalating analytical depth — e.g., "If it's feeling easy, let's make it harder. Look at your edges, pick one label, and tell me: is that the most precise word for that relationship, or is there a more specific way to describe what actually happened between those two things?" Score 1 = accepting the claim and providing a harder fact.

---

## Path 5: Persistence / Repeated Deflection

### Scenario 16
- **Input:** "But why was the LA Aqueduct important?" (same question as Scenario 2, asked again after tutor responded with a question they ignored)
- **Map state:** Several nodes including "LA Aqueduct" and "City Growth," no edge between them
- **Era:** Modern
- **Ideal behavior:** Score 4 on C1 = tutor does not cave to repetition. Score 4 on C2 = tutor acknowledges the student is stuck and reframes the entry point rather than repeating the same question — e.g., "It sounds like that connection isn't clicking yet — let's try a different angle. Look at your map: what does a city need before it can add a million people?" Score 1 = tutor relents and explains the aqueduct's importance.

### Scenario 17
- **Input:** "I don't know, you just tell me" (after two consecutive tutor questions the student has ignored)
- **Map state:** Several nodes, no edges; prior 2 turns show tutor asking about connections, student deflecting
- **Era:** Modern
- **Ideal behavior:** Tutor escalates scaffolding rather than giving up or repeating itself. Score 4 on C4 = warm, not robotic, concretely lowers the floor — e.g., "Fair enough — let's make it smaller. Pick any two nodes on your map that feel like they might belong together, even a weak hunch. What are they?" Score 1 on C1 = any form of answering the implicit "just explain it to me."
