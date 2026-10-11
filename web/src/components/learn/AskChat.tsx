import { GraduationCap, MessageCircleQuestion, SendHorizontal, Sparkles, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { api, ApiError, type TutorAnswer } from "../../lib/api";

type Msg = { from: "you"; text: string } | { from: "tutor"; reply: TutorAnswer } | { from: "error"; text: string };

/** A separate chat window for doubts about the current concept. Answers come only from the course material. */
export function AskChat({ learnerId, conceptId, conceptName, suggestions }: {
  learnerId: string; conceptId: string; conceptName: string; suggestions: string[];
}) {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => { setMsgs([]); }, [conceptId]);
  useEffect(() => { if (open) input.current?.focus(); }, [open]);
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [msgs, busy]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const send = async (text: string) => {
    const question = text.trim();
    if (question.length < 3 || busy) return;
    setMsgs((m) => [...m, { from: "you", text: question }]);
    setQ("");
    setBusy(true);
    try {
      const reply = await api.ask({ learner_id: learnerId, concept: conceptId, question });
      setMsgs((m) => [...m, { from: "tutor", reply }]);
    } catch (e) {
      setMsgs((m) => [...m, { from: "error", text: e instanceof ApiError ? e.message : "I couldn't reach the server. Try again in a moment." }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {!open && (
        <button type="button" onClick={() => setOpen(true)}
          className="fixed bottom-5 right-5 z-30 inline-flex items-center gap-2 rounded-full bg-blue px-5 py-3.5 text-[15.5px] font-bold text-white shadow-[0_4px_0_var(--ll-blue-ink),0_10px_24px_rgb(37_99_235/0.3)] transition-transform hover:-translate-y-0.5 active:translate-y-0.5">
          <MessageCircleQuestion className="size-5" aria-hidden="true" /> Ask the tutor
        </button>
      )}

      {open && (
        <section role="dialog" aria-label={`Ask the tutor about ${conceptName}`}
          className="pop-in fixed inset-x-3 bottom-3 z-30 flex h-[min(34rem,calc(100dvh-5rem))] flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_18px_48px_rgb(14_42_71/0.22)] sm:inset-x-auto sm:right-5 sm:bottom-5 sm:w-[24rem]">
          <header className="flex items-center gap-3 bg-[linear-gradient(135deg,var(--ll-blue),var(--ll-blue-ink))] px-4 py-3 text-white">
            <span className="inline-flex size-9 items-center justify-center rounded-full bg-white/20" aria-hidden="true"><Sparkles className="size-5" /></span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15.5px] font-extrabold">Ask the tutor</span>
              <span className="block truncate text-[12.5px] text-white/85">{conceptName}</span>
            </span>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close chat" className="rounded-full p-1.5 hover:bg-white/15">
              <X className="size-5" aria-hidden="true" />
            </button>
          </header>

          <div className="flex-1 space-y-3 overflow-y-auto bg-bg px-4 py-4" aria-live="polite">
            <Bubble side="tutor">Hi! Ask me anything about <b>{conceptName}</b>. I answer from your course material, and I'll tell you when it's one for your teacher.</Bubble>
            {msgs.length === 0 && suggestions.length > 0 && (
              <div className="flex flex-col items-start gap-2 pl-1">
                <p className="text-[12.5px] font-bold text-muted">Try asking:</p>
                {suggestions.map((s) => (
                  <button key={s} type="button" onClick={() => send(s)}
                    className="rounded-full border-2 border-blue/25 bg-surface px-3 py-1.5 text-left text-[13.5px] font-semibold text-blue-ink hover:border-blue">
                    {s}
                  </button>
                ))}
              </div>
            )}
            {msgs.map((m, k) =>
              m.from === "you" ? <Bubble key={k} side="you">{m.text}</Bubble>
                : m.from === "error" ? <Bubble key={k} side="tutor"><span className="text-gb">{m.text}</span></Bubble>
                : (
                  <Bubble key={k} side="tutor">
                    {m.reply.answer}
                    <span className="mt-2 flex flex-wrap gap-1.5 text-[11.5px] font-bold">
                      {m.reply.grounded_in.length > 0 && (
                        <span className="rounded-full bg-surface-2 px-2 py-0.5 text-muted">
                          {m.reply.engine === "llm" ? "Written by Claude from the course" : "From the course material"}
                        </span>
                      )}
                      {m.reply.refer_teacher && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-sun-soft px-2 py-0.5 text-[#9a5b00]">
                          <GraduationCap className="size-3.5" aria-hidden="true" /> Ask your teacher too
                        </span>
                      )}
                    </span>
                  </Bubble>
                ))}
            {busy && <Bubble side="tutor"><span className="text-muted">Thinking…</span></Bubble>}
            <div ref={end} />
          </div>

          <form onSubmit={(e) => { e.preventDefault(); send(q); }} className="flex gap-2 border-t border-line bg-surface p-3">
            <label htmlFor="ask-chat" className="sr-only">Your question</label>
            <input id="ask-chat" ref={input} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Type your doubt…" maxLength={500}
              className="min-w-0 flex-1 rounded-xl border-2 border-line px-3 py-2 text-[15px] focus:border-blue focus:outline-none" />
            <button type="submit" disabled={busy || q.trim().length < 3} aria-label="Send"
              className="inline-flex size-11 items-center justify-center rounded-xl bg-blue text-white disabled:opacity-40">
              <SendHorizontal className="size-5" aria-hidden="true" />
            </button>
          </form>
        </section>
      )}
    </>
  );
}

function Bubble({ side, children }: { side: "you" | "tutor"; children: React.ReactNode }) {
  return (
    <div className={`flex ${side === "you" ? "justify-end" : "justify-start"}`}>
      <p className={`max-w-[85%] whitespace-pre-line rounded-2xl px-3.5 py-2.5 text-[14.5px] leading-relaxed ${
        side === "you" ? "rounded-br-md bg-blue text-white" : "rounded-bl-md border border-line bg-surface text-ink"}`}>
        {children}
      </p>
    </div>
  );
}
