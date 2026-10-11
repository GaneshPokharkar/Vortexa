import { ConversationProvider, useConversation } from "@elevenlabs/react";
import { AudioLines, Mic, MicOff, PhoneOff, Repeat2 } from "lucide-react";
import { useRef, useState } from "react";
import { GroupBadge } from "../components/ui";
import { api, type Feedback } from "../lib/api";
import { useLearner } from "../lib/learner";

type Line = { role: "user" | "agent"; text: string };

/**
 * Voice tutor (ElevenLabs Agents). The agent talks; our backend decides.
 * The browser gets a short-lived signed URL from /voice/session (the API key never leaves the server) and gives the
 * agent three client tools that call the same diagnosis API as the text tutor: get_question, check_answer, ask_course.
 */
export default function VoiceTutor(props: { learnerId: string; conceptId: string; conceptName: string }) {
  return (
    <ConversationProvider>
      <VoiceInner {...props} />
    </ConversationProvider>
  );
}

function VoiceInner({ learnerId, conceptId, conceptName }: { learnerId: string; conceptId: string; conceptName: string }) {
  const { modes } = useLearner();
  const [lines, setLines] = useState<Line[]>([]);
  const [problem, setProblem] = useState<string | null>(null);
  const [last, setLast] = useState<Feedback | null>(null);
  const itemRef = useRef<string | null>(null);
  const clarifyRef = useRef<number | null>(null);

  // Tool results are short JSON strings the agent reads back in its own words.
  const clientTools = {
    get_question: async () => {
      const { item } = await api.nextItem(learnerId, conceptId, "short");
      itemRef.current = item?.item_id ?? null;
      clarifyRef.current = null;
      return item ? JSON.stringify({ question: item.stem }) : JSON.stringify({ question: null, note: "No short questions left here." });
    },
    check_answer: async (params: { answer_text?: string; original_text?: string }) => {
      const text = (params.answer_text || "").trim();
      if (!text) return JSON.stringify({ error: "No answer heard. Ask the student to repeat it." });
      let fb: Feedback;
      if (clarifyRef.current !== null) {
        fb = await api.clarify({ response_id: clarifyRef.current, text });
      } else {
        if (!itemRef.current) await clientTools.get_question();
        fb = await api.respond({ learner_id: learnerId, item_id: itemRef.current!, answer_text: text });
      }
      clarifyRef.current = fb.follow_up?.kind === "clarify" ? fb.response_id : null;
      setLast(fb);
      return JSON.stringify({
        verdict: fb.group_label,
        say: fb.feedback_text,
        evidence: fb.evidence[0] ?? "",
        ask_next: fb.follow_up?.prompt ?? "",
        waiting_for_clarification: clarifyRef.current !== null,
      });
    },
    ask_course: async (params: { question?: string }) => {
      const a = await api.ask({ learner_id: learnerId, concept: conceptId, question: params.question || "" });
      return JSON.stringify({ answer: a.answer, refer_to_teacher: a.refer_teacher });
    },
  };

  const convo = useConversation({
    clientTools,
    onMessage: (m: { message: string; role?: "user" | "agent" }) =>
      setLines((ls) => [...ls.slice(-5), { role: m.role === "user" ? "user" : "agent", text: m.message }]),
    onError: (message: string) => setProblem(`Voice error: ${message}. You can keep going in text.`),
  });

  const start = async () => {
    setProblem(null);
    const s = await api.voiceSession(learnerId, conceptId).catch(() => null);
    if (!s || !s.available || !s.signed_url) {
      setProblem(s?.reason ?? "Voice is not available right now. Use the text tutor.");
      return;
    }
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setProblem("Microphone permission was blocked. Allow it in the browser, or use the text tutor.");
      return;
    }
    convo.startSession({
      signedUrl: s.signed_url,
      dynamicVariables: { learner_id: learnerId, concept: conceptId, concept_name: conceptName },
    });
  };

  const live = modes?.voice.live;
  const status = convo.status;
  const connected = status === "connected";
  const state = status === "connecting" ? "Connecting…" : connected ? (convo.isSpeaking ? "Tutor is speaking" : "Listening") : status === "error" ? "Connection problem" : "Not connected";

  return (
    <section aria-label="Voice tutor" className="rounded-xl border border-line bg-surface px-5 py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className={`grid size-9 place-items-center rounded-full ${connected ? "bg-blue-soft text-blue-ink" : "bg-surface-2 text-muted"}`}>
            <AudioLines className={`size-4 ${connected && convo.isSpeaking ? "animate-pulse" : ""}`} aria-hidden="true" />
          </span>
          <div>
            <p className="font-medium text-ink">Talk to the tutor</p>
            <p className="text-[13px] text-muted" aria-live="polite">{live ? state : "Voice not configured on this server"}</p>
          </div>
        </div>
        {!connected ? (
          <button onClick={start} disabled={!live || status === "connecting"}
            className="inline-flex items-center gap-2 rounded-lg border border-line-strong px-3.5 py-2 text-[14.5px] text-ink hover:border-blue disabled:cursor-not-allowed disabled:opacity-50">
            <Mic className="size-4" aria-hidden="true" /> Start voice
          </button>
        ) : (
          <div className="flex flex-wrap gap-2">
            <button onClick={() => convo.sendUserMessage("Please repeat your last explanation, a little more slowly.")}
              className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-[14px] hover:border-line-strong">
              <Repeat2 className="size-4" aria-hidden="true" /> Repeat
            </button>
            <button onClick={() => convo.setMuted(!convo.isMuted)} aria-pressed={convo.isMuted}
              className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-[14px] hover:border-line-strong">
              {convo.isMuted ? <MicOff className="size-4" aria-hidden="true" /> : <Mic className="size-4" aria-hidden="true" />}
              {convo.isMuted ? "Unmute" : "Mute"}
            </button>
            <button onClick={() => convo.endSession()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-[14px] hover:border-line-strong">
              <PhoneOff className="size-4" aria-hidden="true" /> End and switch to text
            </button>
          </div>
        )}
      </div>

      {!live && modes && (
        <p className="mt-3 text-[13.5px] text-muted">{modes.voice.note}</p>
      )}
      {problem && <p role="alert" className="mt-3 rounded-lg bg-gb-soft px-3 py-2 text-[14px] text-ink">{problem}</p>}

      {lines.length > 0 && (
        <ol className="mt-3 space-y-1.5 border-t border-line pt-3 text-[14.5px]" aria-label="Voice transcript">
          {lines.map((l, i) => (
            <li key={i} className={l.role === "agent" ? "text-ink" : "text-ink-2"}>
              <span className="text-[12.5px] text-muted">{l.role === "agent" ? "Tutor" : "You"}: </span>{l.text}
            </li>
          ))}
        </ol>
      )}
      {last && (
        <p className="mt-3 flex flex-wrap items-center gap-2 text-[13.5px] text-muted">
          Last spoken answer: <GroupBadge group={last.group} />
          {last.evidence[0] && <span>{last.evidence[0]}</span>}
        </p>
      )}
    </section>
  );
}
