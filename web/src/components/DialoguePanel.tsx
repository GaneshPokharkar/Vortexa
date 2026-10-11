import { CheckCircle2, GraduationCap, Send, Users } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { api, type Dialogue } from "../lib/api";
import { Button, ErrorNote, GroupBadge } from "./ui";

/** Talk it through with Rohan, a classmate who holds one wrong idea. The rules judge every reply. */
export function DialoguePanel({ learnerId, conceptId, code }: { learnerId: string; conceptId: string; code?: string }) {
  const [dlg, setDlg] = useState<Dialogue | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [dlg?.turns.length]);

  const begin = async () => {
    setBusy(true);
    setError(null);
    try {
      setDlg(await api.startDialogue({ learner_id: learnerId, concept: conceptId, code }));
      setTimeout(() => inputRef.current?.focus(), 0);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dlg || !text.trim()) return;
    setBusy(true);
    setError(null);
    try {
      setDlg(await api.replyDialogue(dlg.dialogue_id, text.trim()));
      setText("");
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  if (!dlg) {
    return (
      <div className="rounded-xl border border-line bg-surface p-5">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-gc-soft text-gc"><Users className="size-5" aria-hidden="true" /></span>
          <div className="flex-1">
            <p className="font-medium text-ink">Talk it through with a classmate</p>
            <p className="mt-1 text-[15px] text-muted">
              Rohan is sure about a common wrong idea on this topic. Explain the physics until he's convinced.
              Explaining it is one of the best ways to check you really understand it.
            </p>
            <Button className="mt-4" onClick={begin} disabled={busy}>Start the conversation</Button>
          </div>
        </div>
        {error ? <div className="mt-4"><ErrorNote error={error} /></div> : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col rounded-xl border border-line bg-surface">
      <div className="border-b border-line px-5 py-3.5">
        <p className="text-[15px] text-ink"><span className="font-medium">{dlg.peer_name} thinks:</span> {dlg.peer_belief}</p>
        <p className="mt-0.5 text-[13px] text-muted">{dlg.engine_note}</p>
      </div>

      <ol className="flex max-h-[440px] flex-col gap-4 overflow-y-auto px-5 py-4" aria-live="polite" aria-label="Conversation">
        {dlg.turns.map((t, i) =>
          t.role === "peer" ? (
            <li key={i} className="flex max-w-[85%] gap-2.5">
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-gc-soft text-[13px] font-semibold text-gc" aria-hidden="true">R</span>
              <div>
                <p className="text-[12.5px] text-muted">{dlg.peer_name}</p>
                <p className="read mt-0.5 rounded-2xl rounded-tl-sm bg-surface-2 px-3.5 py-2.5 text-[16px] text-ink">{t.text}</p>
              </div>
            </li>
          ) : (
            <li key={i} className="ml-auto flex max-w-[85%] flex-col items-end">
              <p className="text-[12.5px] text-muted">You</p>
              <p className="read mt-0.5 rounded-2xl rounded-tr-sm bg-blue-soft px-3.5 py-2.5 text-[16px] text-ink">{t.text}</p>
              <div className="mt-1.5 flex flex-wrap items-center justify-end gap-2">
                <GroupBadge group={t.group} />
                {t.flagged_description && <span className="text-[13px] text-muted">sounds like: {t.flagged_description}</span>}
              </div>
            </li>
          ),
        )}
        <div ref={endRef} />
      </ol>

      {dlg.status === "resolved" && (
        <p className="mx-5 mb-4 flex items-center gap-2 rounded-lg bg-ga-soft px-3.5 py-2.5 text-[15px] text-ga" role="status">
          <CheckCircle2 className="size-4" aria-hidden="true" /> You convinced {dlg.peer_name}. Your explanation held up.
        </p>
      )}
      {dlg.status === "unresolved" && (
        <p className="mx-5 mb-4 flex items-center gap-2 rounded-lg bg-surface-2 px-3.5 py-2.5 text-[15px] text-ink-2" role="status">
          <GraduationCap className="size-4" aria-hidden="true" /> This one is worth taking to your teacher. They can see where the conversation got stuck.
        </p>
      )}

      {dlg.status === "open" && (
        <form onSubmit={send} className="flex items-end gap-2 border-t border-line px-4 py-3">
          <label className="flex-1">
            <span className="sr-only">Your reply to {dlg.peer_name}</span>
            <textarea
              ref={inputRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  (e.currentTarget.form as HTMLFormElement).requestSubmit();
                }
              }}
              rows={2}
              placeholder={`Explain to ${dlg.peer_name} why…`}
              className="read w-full resize-none rounded-lg border border-line-strong bg-surface px-3 py-2 text-[16px] text-ink placeholder:text-muted focus:border-blue focus:outline-none"
            />
          </label>
          <div className="flex flex-col items-end gap-1">
            <span className="text-[12.5px] text-muted">{dlg.turns_left} {dlg.turns_left === 1 ? "reply" : "replies"} left</span>
            <Button type="submit" disabled={busy || !text.trim()} aria-label="Send reply">
              <Send className="size-4" aria-hidden="true" /> Send
            </Button>
          </div>
        </form>
      )}
      {error ? <div className="px-5 pb-4"><ErrorNote error={error} /></div> : null}
    </div>
  );
}
