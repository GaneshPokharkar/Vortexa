import { KeyRound, Lock } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ContentReview } from "../components/ContentReview";
import { Button, Empty, ErrorNote, Loading, PageHeader } from "../components/ui";
import { ApiError, api, type ClassMap, type TeacherFlag } from "../lib/api";

const KEY = "learnloop.reviewer";

function readToken(): string {
  try {
    return sessionStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
}

const STATUS_STYLE: Record<TeacherFlag["status"], { label: string; cls: string }> = {
  confirmed: { label: "Confirmed", cls: "bg-gb-soft text-gb" },
  suspected: { label: "Suspected", cls: "bg-gc-soft text-gc" },
  resolved: { label: "Resolved", cls: "bg-ga-soft text-ga" },
};

export default function Teacher() {
  const [token, setToken] = useState(readToken);
  const [draft, setDraft] = useState("");
  const [data, setData] = useState<ClassMap | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [concept, setConcept] = useState("all");
  const [tab, setTab] = useState<"map" | "review">("map");

  useEffect(() => {
    if (!token) return;
    setData(null);
    setError(null);
    api.teacherMap(token).then(setData).catch((e) => {
      if (e instanceof ApiError && e.status === 401) {
        setToken("");
        try { sessionStorage.removeItem(KEY); } catch { /* ignore */ }
      }
      setError(e);
    });
  }, [token]);

  const students = useMemo(() => {
    if (!data) return [];
    return data.students
      .map((s) => ({ ...s, flags: s.flags.filter((f) => concept === "all" || f.concept === concept) }))
      .filter((s) => s.flags.length);
  }, [data, concept]);

  if (!token) {
    return (
      <div className="mx-auto max-w-md pt-16">
        <span className="grid size-11 place-items-center rounded-full bg-surface-2 text-ink-2"><Lock className="size-5" aria-hidden="true" /></span>
        <h1 className="mt-4 text-[26px] font-semibold">Teacher view</h1>
        <p className="mt-2 text-muted">Enter the reviewer token from the school's LearnLoop setup. It stays in this browser tab only.</p>
        <form className="mt-6 flex gap-2" onSubmit={(e) => { e.preventDefault(); try { sessionStorage.setItem(KEY, draft); } catch { /* ignore */ } setToken(draft); }}>
          <label className="flex-1">
            <span className="sr-only">Reviewer token</span>
            <input type="password" value={draft} onChange={(e) => setDraft(e.target.value)} autoComplete="off"
              className="w-full rounded-lg border border-line-strong bg-surface px-3 py-2.5 focus:border-blue focus:outline-none" placeholder="Reviewer token" />
          </label>
          <Button type="submit" disabled={!draft}><KeyRound className="size-4" aria-hidden="true" /> Open</Button>
        </form>
        {error ? <div className="mt-4"><ErrorNote error={error} /></div> : null}
      </div>
    );
  }

  const tabs = (
    <div role="tablist" aria-label="Teacher view" className="mt-6 inline-flex rounded-lg border border-line bg-surface p-1">
      {([["map", "Class misconception map"], ["review", "Content review"]] as const).map(([id, label]) => (
        <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
          className={`rounded-md px-3.5 py-1.5 text-[14.5px] ${tab === id ? "bg-blue-soft font-medium text-blue-ink" : "text-ink-2 hover:bg-surface-2"}`}>
          {label}
        </button>
      ))}
    </div>
  );
  if (tab === "review") {
    return (
      <div>
        {tabs}
        <PageHeader title="Content review">Answer keys, how each wrong option maps to an idea, and what still needs a physics teacher's check.</PageHeader>
        <ContentReview token={token} />
      </div>
    );
  }
  if (error) return <div className="pt-10"><ErrorNote error={error} /></div>;
  if (!data) return <Loading what="the class map" />;

  const maxStudents = Math.max(1, ...data.concepts.flatMap((c) => c.misconceptions.map((m) => m.active + m.resolved)));

  return (
    <div>
      {tabs}
      <PageHeader title="Class misconception map"
        aside={
          <label className="flex items-center gap-2 text-[14px] text-muted">
            Concept
            <select value={concept} onChange={(e) => setConcept(e.target.value)}
              className="rounded-lg border border-line-strong bg-surface px-2.5 py-1.5 text-ink">
              <option value="all">All concepts</option>
              {data.concepts.map((c) => <option key={c.concept} value={c.concept}>{c.concept} · {c.name}</option>)}
            </select>
          </label>
        }>
        {data.note}
      </PageHeader>

      <section aria-labelledby="ideas" className="rounded-xl border border-line bg-surface">
        <h2 id="ideas" className="border-b border-line px-5 py-3 text-[16px] font-semibold">Faulty ideas in the class</h2>
        <div className="divide-y divide-line">
          {data.concepts.filter((c) => concept === "all" || c.concept === concept).map((c) => (
            <div key={c.concept} className="grid gap-3 px-5 py-4 md:grid-cols-[14rem_minmax(0,1fr)]">
              <p className="text-[15px] text-ink"><span className="num mr-1.5 text-muted">{c.concept}</span>{c.name}</p>
              <ul className="space-y-2.5">
                {c.misconceptions.map((m) => (
                  <li key={m.code} className="grid items-center gap-x-3 gap-y-1 sm:grid-cols-[minmax(0,1fr)_12rem]">
                    <span className="text-[14.5px] text-ink-2"><span className="num mr-1.5 font-medium text-ink">{m.code}</span>{m.description}</span>
                    <span className="flex items-center gap-2" aria-label={`${m.active} students still hold it, ${m.resolved} resolved`}>
                      <span className="flex h-2.5 flex-1 overflow-hidden rounded-full bg-surface-2">
                        <span className="h-full bg-gb" style={{ width: `${(100 * m.active) / maxStudents}%` }} />
                        <span className="h-full bg-ga" style={{ width: `${(100 * m.resolved) / maxStudents}%` }} />
                      </span>
                      <span className="num w-16 text-right text-[13px] text-muted">{m.active} · {m.resolved}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p className="border-t border-line px-5 py-2.5 text-[13px] text-muted">
          <span className="mr-1 inline-block size-2.5 rounded-full bg-gb align-middle" /> students who still hold the idea
          <span className="ml-4 mr-1 inline-block size-2.5 rounded-full bg-ga align-middle" /> resolved since
        </p>
      </section>

      <section aria-labelledby="students" className="mt-8">
        <h2 id="students" className="text-[18px] font-semibold">Students</h2>
        {students.length === 0 ? (
          <div className="mt-4"><Empty title="No flagged ideas yet">Flags appear here when a student's answer or conversation shows a known wrong idea.</Empty></div>
        ) : (
          <ul className="mt-4 space-y-4">
            {students.map((s) => (
              <li key={s.label} className="rounded-xl border border-line bg-surface">
                <p className="flex items-center gap-2 border-b border-line px-5 py-3 font-medium text-ink">
                  {s.label}
                  {s.is_demo && <span className="rounded bg-gc-soft px-1.5 text-[11.5px] font-medium text-gc">Demo</span>}
                </p>
                <ul className="divide-y divide-line">
                  {s.flags.map((f) => (
                    <li key={f.code} className="grid gap-x-4 gap-y-1.5 px-5 py-3.5 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
                      <span className="text-[14.5px] text-ink"><span className="num mr-1.5 font-medium">{f.code}</span>{f.description}</span>
                      <span className="read text-[15.5px] italic text-ink-2">“{f.quote}”</span>
                      <span className="flex flex-wrap items-center gap-2 text-[13px] text-muted md:justify-end">
                        <span className={`rounded-full px-2 py-0.5 font-medium ${STATUS_STYLE[f.status].cls}`}>{STATUS_STYLE[f.status].label}</span>
                        {f.source === "dialogue" ? "in a conversation" : "in practice"} · {f.times}×
                      </span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
