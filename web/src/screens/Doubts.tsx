import { ArrowRight, Info, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Empty, ErrorNote, Loading, PageHeader } from "../components/ui";
import { api, type Concept, type Doubts as DoubtsData } from "../lib/api";

export default function Doubts() {
  const [q, setQ] = useState("");
  const [concept, setConcept] = useState<string>("");
  const [data, setData] = useState<DoubtsData | null>(null);
  const [concepts, setConcepts] = useState<Concept[]>([]);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => { api.concepts().then(setConcepts).catch(() => {}); }, []);
  useEffect(() => {
    const t = setTimeout(() => api.doubts(q.trim() || undefined, concept || undefined).then(setData).catch(setError), 200);
    return () => clearTimeout(t);
  }, [q, concept]);

  const name = new Map(concepts.map((c) => [c.concept_id, c.name]));

  return (
    <div>
      <PageHeader title="Common doubts">Questions students often ask, with short answers. Open a concept to practise or ask the tutor your own.</PageHeader>
      {data && (
        <p className="mb-5 flex items-start gap-2 rounded-lg bg-surface-2 px-4 py-2.5 text-[14px] text-ink-2">
          <Info className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden="true" /> {data.note}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <label className="relative min-w-0 flex-1 basis-64">
          <span className="sr-only">Search doubts</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search, e.g. amplitude, critical angle"
            className="w-full rounded-lg border border-line-strong bg-surface py-2.5 pl-9 pr-3 text-[15px] focus:border-blue focus:outline-none" />
        </label>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by concept">
          {[["", "All"], ...concepts.map((c) => [c.concept_id, c.concept_id])].map(([id, label]) => (
            <button key={id} onClick={() => setConcept(id)} aria-pressed={concept === id}
              className={`num rounded-full border px-3 py-1 text-[13.5px] ${concept === id ? "border-blue bg-blue-soft text-blue-ink" : "border-line bg-surface text-ink-2 hover:border-line-strong"}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {error ? <div className="mt-6"><ErrorNote error={error} /></div> : null}
      {!data && !error && <Loading what="doubts" />}
      {data && data.doubts.length === 0 && <div className="mt-6"><Empty title="No doubts match that search">Try fewer words, or ask the tutor directly from a concept page.</Empty></div>}

      {data && data.doubts.length > 0 && (
        <ul className="mt-6 divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
          {data.doubts.map((d) => (
            <li key={d.id}>
              <details className="group px-5 py-4">
                <summary className="flex cursor-pointer list-none items-start justify-between gap-4">
                  <span>
                    <span className="num text-[13px] text-muted">{d.concept} · {name.get(d.concept)}</span>
                    <span className="read mt-0.5 block text-[17px] text-ink">{d.q}</span>
                  </span>
                  <span className="mt-1 text-[13px] text-blue-ink group-open:hidden">Show answer</span>
                </summary>
                <p className="read mt-3 text-[16px] text-ink-2">{d.a}</p>
                <Link to={`/learn/${d.concept}`} className="mt-3 inline-flex items-center gap-1.5 text-[14.5px] text-blue-ink hover:underline">
                  Open this concept or ask the tutor <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
              </details>
            </li>
          ))}
        </ul>
      )}

      {data?.trends && (
        <section className="mt-8">
          <h2 className="text-[18px] font-semibold">Measured across this class</h2>
          <ul className="mt-3 space-y-2">
            {data.trends.map((t) => <li key={t.code} className="text-[15px] text-ink-2">{t.description} <span className="text-muted">· {t.learners} students</span></li>)}
          </ul>
        </section>
      )}
    </div>
  );
}
