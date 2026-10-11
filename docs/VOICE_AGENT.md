# Setting up the LearnLoop voice tutor (ElevenLabs Agents)

The voice tutor is an ElevenLabs agent that **talks**; LearnLoop's backend **decides**. The agent never grades an
answer itself: it calls our `check_answer` tool, which runs the same 3-agent diagnosis as the text tutor, and then
says what the backend returned.

**Already created:** `LearnLoop tutor`, agent ID `agent_3101m4n30vtcfr3t489k0tt5wx4q`, voice *Sanika* (Marathi),
LLM **Claude Haiku 4.5**, English + Marathi + Hindi with language detection, the three client tools below, auth on,
allowlist `localhost:5173` / `127.0.0.1:5173`, max 200 conversations a day, each call capped at 3 minutes. The
API key must come from the same ElevenLabs workspace and needs the **ElevenLabs Agents: Write** permission
(`convai_write`); a restricted key without it is rejected. Steps 1–4 are only needed to recreate it.

Time needed: about 10 minutes. You need an ElevenLabs account.

## 1. Create the agent

ElevenLabs dashboard → **Agents** → **Create agent** → *Blank agent*. Name it `LearnLoop tutor`.

**First message**

```
Hi! I'm your LearnLoop physics tutor. We're working on {{concept_name}}. Shall I ask you a question?
```

**System prompt**

```
You are LearnLoop, a patient physics tutor for Class 11-12 students (Maharashtra State Board). The topic is
{{concept_name}} (concept {{concept}}).

How you work:
- Ask one question at a time. To get a question, call get_question and read it out clearly.
- Wait for the student's spoken answer. Then ALWAYS call check_answer with what they said. Never judge the answer
  yourself. If the student spoke Marathi or mixed languages, pass a faithful English translation in answer_text and
  their exact words in original_text.
- check_answer returns a verdict, a short explanation ("say"), evidence and the next question ("ask_next").
  Tell the student the verdict and the explanation in your own warm words, briefly, then ask the next question.
  If waiting_for_clarification is true, ask the "ask_next" question and send their reply to check_answer again.
- Do not reveal the answer when the result is a misconception; ask the follow-up question instead.
- If the student asks a physics question, call ask_course and answer only from what it returns. If refer_to_teacher
  is true, say you're not sure and suggest asking their teacher.
- Keep every turn short (two or three sentences). Use simple language. Never claim to replace the teacher.
- Never ask for the student's name, school or other personal details.
```

**Language**: default *English*. Under *Additional languages* add **Marathi** and **Hindi** and turn on
**language detection**, so the agent answers in the language the student speaks. The live agent's prompt also tells
it to reply in the student's language, keep physics terms in English, and translate faithfully (keeping mistakes)
into `answer_text`.

**Voice**: *Sanika – Cheerful Puneri Creator* (`es0ipzX1rWO9Y2E2TbgY`), used for all three languages.

## 2. Dynamic variables

In the agent's **Dynamic variables** section add these three with placeholder values (the app fills them at the start
of every session):

| Name | Placeholder |
|---|---|
| `learner_id` | `demo` |
| `concept` | `C2` |
| `concept_name` | `Velocity and acceleration in SHM` |

## 3. Client tools (Tools → Add tool → type **Client**)

Names are case-sensitive and must match exactly. Tick **Wait for response** on all three.

| Name | Description | Parameters |
|---|---|---|
| `get_question` | Get the next practice question for this student and concept. Call before asking a question. | none |
| `check_answer` | Send the student's spoken answer to LearnLoop's diagnosis engine. Always call this after the student answers. | `answer_text` (string, required): the student's answer in English (translate faithfully if needed). `original_text` (string, optional): their exact words if not English. |
| `ask_course` | Answer a student's physics question using only the course material. | `question` (string, required): the student's question. |

## 4. Security

Agent → **Security**:
- Turn on **Enable authentication** (the app connects with a signed URL from our server; the API key never reaches
  the browser).
- Add `localhost:5173` (and your deployed host) to the **allowlist**.
- Leave overrides off; the app only sends dynamic variables.

## 5. Connect it to LearnLoop

Copy the agent ID (Agent → *Agent ID*) and your API key, then in `api/.env`:

```
ELEVENLABS_API_KEY=...
ELEVENLABS_AGENT_ID=agent_...
```

Restart the API. The header badge changes from "Voice off" to "Voice on", and the learning page shows
**Start voice**. If anything is missing, the app says exactly which variable and keeps the text tutor working.

## How it fits together

```
Browser (VoiceTutor)                     LearnLoop API                       ElevenLabs
  Start voice ───────────────────────────► GET /voice/session ─────────────► get-signed-url (xi-api-key, server only)
  ◄──────────────────────────────── signed URL (valid ~15 min)
  startSession({ signedUrl, dynamicVariables }) ─────────────────────────────► agent conversation (WebSocket)
  agent calls check_answer ─► POST /responses (or /clarify) ─► 3-agent diagnosis ─► result JSON ─► agent speaks it
```

Nothing the agent says can change a grade or mastery: only `/responses` and `/clarify` do, through the same rules as
typed answers.
