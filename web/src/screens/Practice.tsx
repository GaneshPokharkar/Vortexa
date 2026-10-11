import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { ErrorNote, Loading, Panel, btnPrimary, btnQuiet } from "../components/ui";
import { api, type Feedback, type PublicItem, type Why } from "../lib/api";
import { CATEGORY, TONE_VAR, pct } from "../lib/meta";
import { useLearner } from "../learner";

type Stage =
  | { kind: "loading" }
  | { kind: "done" }
  | { kind: "question"; item: PublicItem; before: number }
  | { kind: "result"; item: PublicItem; before: number; fb: Feedback };

export default function Practice() {
  const { conceptId } = useParams();
  const { learner } = useLearner();
  const [stage, setStage] = useState<Stage>({ kind: "loading" });
  const [error, setError] = useState<unknown>(null);

  const load = () => {
    setStage({ kind: "loading" });
    setError(null);
    api
      .nextItem(learner, conceptId)
      .then(async ({ item }) => {
        if (!item) return setStage({ kind: "done" });
        const m = await api.mastery(learner);
        const before = m.concepts.find((c) => c.concept === item.concept)?.p_learned ?? 0.25;
        setStage({ kind: "question", item, before });
      })
      .catch(setError);
  };

  useEffect(load, [learner, conceptId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (error) return <ErrorNote error={error} />;
  if (stage.kind === "loading") return <Loading what="your next question" />;
  if (stage.kind === "done")
    return (
      <div className="pt-10">
        <h1 className="text-2xl font-semibold">Nothing left to practise here</h1>
        <p className="mt-2 text-muted">Every concept on this path is mastered. Check the Mastery page, or pick a concept on the path to revise.</p>
        <Link to="/" className={`${btnQuiet} mt-6`}>Back to path</Link>
      </div>
    );

  const { item } = stage;
  return (
    <div className="pt-6">
      <div className="flex items-center justify-between gap-4">
        <Link to={`/learn/${item.concept}`} className="text-sm text-muted hover:text-text">
          Concept <span className="num">{item.concept}</span>: read the card
        </Link>
        <span className="num text-xs text-muted">{item.item_id}</span>
      </div>
      <h1 className="mt-4 max-w-3xl font-head text-xl leading-relaxed font-medium sm:text-2xl">{item.stem}</h1>

      {stage.kind === "question" ? (
        <QuestionForm
          item={item}
          onResult={(fb) => setStage({ kind: "result", item, before: stage.before, fb })}
        />
      ) : stage.fb.category === "AMBIGUOUS" ? (
        <Clarify fb={stage.fb} onResult={(fb) => setStage({ ...stage, fb })} />
      ) : (
        <FeedbackView fb={stage.fb} before={stage.before} onNext={load} />
      )}
    </div>
  );
}

/* ---------- Question: answer -> reason -> confidence, one screen ---------- */

function Tier({ n, title, children, disabled }: { n: number; title: string; children: ReactNode; disabled?: boolean }) {
  return (
    <fieldset disabled={disabled} className={`transition-opacity ${disabled ? "opacity-40" : ""}`}>
      <legend className="flex items-center gap-3 font-head text-base font-semibold">
        <span className="num grid size-6 place-items-center rounded-full border border-line text-xs text-muted">{n}</span>
        {title}
      </legend>
      <div className="mt-3">{children}</div>
    </fieldset>
  );
}

function Choice({ name, value, checked, onChange, children }: {
  name: string; value: string; checked: boolean; onChange: () => void; children: ReactNode;
}) {
  return (
    <label
      className={`flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-teal ${
        checked ? "border-teal bg-teal/10" : "border-line bg-panel hover:border-muted"
      }`}
    >
      <input type="radio" name={name} value={value} checked={checked} onChange={onChange} className="sr-only" />
      {children}
    </label>
  );
}

function QuestionForm({ item, onResult }: { item: PublicItem; onResult: (fb: Feedback) => void }) {
  const { learner } = useLearner();
  const [option, setOption] = useState<string | null>(null);
  const [reason, setReason] = useState<string | null>(null); // "r1".."r3" or "own"
  const [text, setText] = useState("");
  const [confidence, setConfidence] = useState<"sure" | "unsure" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const reasonReady = reason !== null && (reason !== "own" || text.trim().length > 0);
  const ready = option && reasonReady && confidence;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ready) return;
    setBusy(true);
    setError(null);
    try {
      onResult(
        await api.respond({
          learner_id: learner,
          item_id: item.item_id,
          option,
          confidence,
          ...(reason === "own" ? { reason_text: text.trim() } : { reason_id: reason }),
        }),
      );
    } catch (err) {
      setError(err);
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="mt-8 grid max-w-3xl gap-8">
      <Tier n={1} title="Your answer">
        <div className="grid gap-2 sm:grid-cols-2">
          {(Object.entries(item.options) as [string, string][]).map(([k, v]) => (
            <Choice key={k} name="option" value={k} checked={option === k} onChange={() => setOption(k)}>
              <span className="num mt-px text-sm text-muted">{k}</span>
              <span>{v}</span>
            </Choice>
          ))}
        </div>
      </Tier>

      <Tier n={2} title="Why?" disabled={!option}>
        <div className="grid gap-2">
          {(Object.entries(item.reasons) as [string, string][]).map(([k, v]) => (
            <Choice key={k} name="reason" value={k} checked={reason === k} onChange={() => setReason(k)}>
              <span>{v}</span>
            </Choice>
          ))}
          <Choice name="reason" value="own" checked={reason === "own"} onChange={() => setReason("own")}>
            <span className="text-muted">Explain in my own words</span>
          </Choice>
          {reason === "own" && (
            <textarea
              aria-label="Your reason, in your own words"
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={3}
              placeholder="Say what you think is happening and why."
              className="rounded-xl border border-line bg-bg px-4 py-3 placeholder:text-muted/70 focus:border-teal focus:outline-none"
            />
          )}
        </div>
      </Tier>

      <Tier n={3} title="How sure are you?" disabled={!reasonReady}>
        <div className="flex gap-2">
          {(["sure", "unsure"] as const).map((c) => (
            <Choice key={c} name="confidence" value={c} checked={confidence === c} onChange={() => setConfidence(c)}>
              <span>{c === "sure" ? "Sure" : "Not sure"}</span>
            </Choice>
          ))}
        </div>
      </Tier>

      {error ? <ErrorNote error={error} /> : null}
      <div>
        <button type="submit" disabled={!ready || busy} className={btnPrimary}>
          {busy ? "Checking…" : "Check my answer"}
        </button>
      </div>
    </form>
  );
}

/* ---------- Feedback ---------- */

function FeedbackView({ fb, before, onNext }: { fb: Feedback; before: number; onNext: () => void }) {
  const meta = CATEGORY[fb.category];
  const tone = TONE_VAR[meta.tone];
  const [whyOpen, setWhyOpen] = useState(false);
  const closeWhy = useCallback(() => setWhyOpen(false), []);
  const counted = fb.category !== "UNDIAGNOSED";

  return (
    <div className="mt-8 grid max-w-3xl gap-6">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="rounded-2xl border bg-panel p-6 sm:p-8"
        style={{ borderColor: tone }}
        role="status"
      >
        <p className="font-head text-3xl font-semibold sm:text-4xl" style={{ color: tone }}>{meta.label}</p>
        <p className="mt-3 max-w-prose text-lg">{meta.line}</p>

        <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted">
          <span>
            Learned{" "}
            {counted ? (
              <>
                <span className="num text-text">{pct(before)}</span> to{" "}
                <span className="num" style={{ color: fb.mastery.p_learned >= before ? "var(--green)" : "var(--coral)" }}>
                  {pct(fb.mastery.p_learned)}
                </span>
              </>
            ) : (
              <span className="text-text">unchanged</span>
            )}
          </span>
          {fb.misconception_code && (
            <span>
              Wrong idea <span className="num text-text">{fb.misconception_code}</span>{" "}
              {fb.misconception_status === "CONFIRMED" ? (
                <span className="text-coral">confirmed: seen on two questions</span>
              ) : (
                <span>seen once so far</span>
              )}
            </span>
          )}
        </div>
      </motion.div>

      <Panel className="p-5">
        <h2 className="text-base font-semibold">What to do next</h2>
        <ul className="mt-3 grid gap-2 text-sm">
          {fb.misconception_code && (
            <li>
              <Link className="text-teal underline-offset-4 hover:underline" to={`/learn/${fb.mastery.concept}?card=${fb.remediation_card_id}`}>
                Read why this idea doesn't work
              </Link>
            </li>
          )}
          {!fb.misconception_code && fb.category !== "SCIENTIFIC" && (
            <li>
              <Link className="text-teal underline-offset-4 hover:underline" to={`/learn/${fb.mastery.concept}`}>
                Go over the main idea for this concept
              </Link>
            </li>
          )}
          {fb.sibling_scheduled && <li className="text-muted">Your next question is a similar one, to check it was just a slip.</li>}
          {fb.followup_item_ids.length > 0 && (
            <li className="text-muted">
              Questions that test this idea: <span className="num">{fb.followup_item_ids.join(", ")}</span>
            </li>
          )}
          {fb.category === "SCIENTIFIC" && <li className="text-muted">Keep going: the next question builds on this.</li>}
        </ul>
      </Panel>

      <div className="flex flex-wrap gap-3">
        <button onClick={onNext} className={btnPrimary}>Next question</button>
        <button onClick={() => setWhyOpen(true)} className={btnQuiet}>Why this diagnosis?</button>
      </div>

      <WhyDrawer responseId={fb.response_id} open={whyOpen} onClose={closeWhy} />
    </div>
  );
}

/* ---------- Clarify ---------- */

function Clarify({ fb, onResult }: { fb: Feedback; onResult: (fb: Feedback) => void }) {
  const c = fb.clarify!;
  const [reason, setReason] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      onResult(await api.clarify({ response_id: fb.response_id, ...(reason ? { reason_id: reason } : { text: text.trim() }) }));
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
      setReason(null);
      setText("");
    }
  };

  return (
    <form onSubmit={send} className="mt-8 grid max-w-3xl gap-6">
      <div className="rounded-2xl border border-teal bg-panel p-6 sm:p-8" role="status">
        <p className="font-head text-3xl font-semibold text-teal">{CATEGORY.AMBIGUOUS.label}</p>
        <p className="mt-3 text-lg">
          {fb.rule_fired === "slip:4"
            ? CATEGORY.AMBIGUOUS.line
            : "WaveLoop couldn't match your explanation to a reason yet. Pick the one closest to what you meant."}
        </p>
        {c.probes.map((p) => (
          <p key={p} className="mt-5 max-w-prose rounded-lg border-l-2 border-teal bg-bg/50 px-4 py-3 font-head text-lg">{p}</p>
        ))}
        <p className="mt-4 text-sm text-muted">
          {c.remaining === 1 ? "Last chance to clarify" : `${c.remaining} chances to clarify`}. Nothing you type here changes your mastery.
        </p>
      </div>

      <fieldset>
        <legend className="font-head text-base font-semibold">Which of these matches what you think?</legend>
        <div className="mt-3 grid gap-2">
          {Object.entries(c.reasons).map(([k, v]) => (
            <Choice key={k} name="clarify" value={k} checked={reason === k} onChange={() => setReason(k)}>
              <span>{v}</span>
            </Choice>
          ))}
        </div>
      </fieldset>
      <label className="grid gap-2">
        <span className="text-sm text-muted">Or answer the question above in your own words</span>
        <textarea
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            if (e.target.value) setReason(null);
          }}
          rows={2}
          className="rounded-xl border border-line bg-bg px-4 py-3 focus:border-teal focus:outline-none"
        />
      </label>
      {error ? <ErrorNote error={error} /> : null}
      <div>
        <button type="submit" disabled={busy || (!reason && !text.trim())} className={btnPrimary}>
          {busy ? "Sending…" : "Send"}
        </button>
      </div>
    </form>
  );
}

/* ---------- Why this diagnosis? ---------- */

function WhyDrawer({ responseId, open, onClose }: { responseId: number; open: boolean; onClose: () => void }) {
  const [why, setWhy] = useState<Why | null>(null);
  const [error, setError] = useState<unknown>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    api.why(responseId).then(setWhy).catch(setError);
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, responseId, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div className="fixed inset-0 z-40 bg-bg/70" onClick={onClose}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-labelledby="why-title"
            className="fixed inset-y-0 right-0 z-50 w-full max-w-md overflow-y-auto border-l border-line bg-panel p-6 sm:p-8"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "tween", duration: 0.22 }}
          >
            <div className="flex items-start justify-between gap-4">
              <h2 id="why-title" className="text-xl font-semibold">Why this diagnosis?</h2>
              <button ref={closeRef} onClick={onClose} className="rounded-md px-2 py-1 text-muted hover:text-text">Close</button>
            </div>
            <p className="mt-2 text-sm text-muted">
              Fixed rules made this call, not AI. Here is exactly which rule fired and what it looked at.
            </p>
            {error ? <div className="mt-6"><ErrorNote error={error} /></div> : null}
            {!why && !error && <Loading what="the rule trace" />}
            {why && (
              <dl className="mt-6 grid gap-5">
                <Row term="Rule that fired">
                  <span className="num text-teal">{why.rule_fired}</span>
                  <span className="mt-1 block">{why.rule_text}</span>
                </Row>
                <Row term="The answer you chose">
                  {Object.entries(why.distractor_map_entry).map(([opt, code]) => (
                    <span key={opt}>
                      Option <span className="num">{opt}</span> is linked to <Code code={code} />
                    </span>
                  ))}
                </Row>
                <Row term="The reason you gave">
                  {why.reason ? (
                    <span>
                      Reason <span className="num">{why.reason.reason_id}</span> is linked to <Code code={why.reason.maps_to} />
                    </span>
                  ) : (
                    <span>In your own words: “{why.reason_text}”</span>
                  )}
                </Row>
                <Row term="AI classifier confidence">
                  {why.classifier_confidence === null ? (
                    <span className="text-muted">Not used for this answer.</span>
                  ) : (
                    <span className="num">{why.classifier_confidence.toFixed(2)}</span>
                  )}
                </Row>
                <Row term="Clarifying questions asked">
                  <span className="num">{why.clarifications}</span>
                </Row>
              </dl>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

function Row({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-sm text-muted">{term}</dt>
      <dd className="mt-1">{children}</dd>
    </div>
  );
}

function Code({ code }: { code: string }) {
  const label: Record<string, string> = { CORRECT: "the correct idea", SLIP: "a careless-number slip", UNMAPPED: "no known wrong idea" };
  return label[code] ? <span>{label[code]}</span> : <span>wrong idea <span className="num text-coral">{code}</span></span>;
}
