import { ArrowRight, ChevronDown, Info, Search, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ConceptTile, Empty, ErrorNote, Loading, PageHeader, Panel } from "../components/ui";
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
    <div className="pb-10">
      <PageHeader title="Got a doubt?">Lots of students ask the same things. Find yours here with a short answer, then practise it or ask the tutor your own question.</PageHeader>

      <div className="grid gap-3">
        <label className="relative block">
          <span className="sr-only">Search doubts</span>
          <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-blue" aria-hidden="true" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search, e.g. amplitude, critical angle"
            className="w-full rounded-2xl border-2 border-line bg-surface py-3.5 pl-12 pr-4 text-[16px] shadow-[0_2px_0_var(--ll-line)] focus:border-blue focus:outline-none" />
        </label>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by concept">
          {[["", "All ideas"], ...concepts.map((c) => [c.concept_id, c.name])].map(([id, label]) => (
            <button key={id} onClick={() => setConcept(id)} aria-pressed={concept === id}
              className={`inline-flex items-center gap-1.5 rounded-full border-2 px-3 py-1 text-[13.5px] font-bold transition-colors ${
                concept === id ? "border-blue bg-blue text-white" : "border-line bg-surface text-ink-2 hover:border-blue"}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {data && (
        <p className="mt-4 flex items-start gap-2 text-[14px] text-muted">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" /> {data.note}
        </p>
      )}

      {error ? <div className="mt-6"><ErrorNote error={error} /></div> : null}
      {!data && !error && <Loading what="doubts" />}
      {data && data.doubts.length === 0 && <div className="mt-6"><Empty title="No doubts match that search">Try fewer words, or ask the tutor directly from a concept page.</Empty></div>}

      {data && data.doubts.length > 0 && (
        <ul className="mt-5 grid gap-3">
          {data.doubts.map((d) => (
            <li key={d.id}>
              <details className="group rounded-2xl border border-line bg-surface shadow-[0_2px_0_var(--ll-line)] open:border-blue/40">
                <summary className="flex cursor-pointer list-none items-start gap-4 rounded-2xl px-5 py-4 [&::-webkit-details-marker]:hidden">
                  <ConceptTile id={d.concept} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="text-[13px] font-semibold text-muted">{name.get(d.concept) ?? d.concept}</span>
                    <span className="mt-0.5 block text-[17px] font-bold leading-snug text-ink">{d.q}</span>
                  </span>
                  <span className="mt-1 inline-flex shrink-0 items-center gap-1 text-[13.5px] font-bold text-blue-ink">
                    <span className="hidden sm:inline group-open:hidden">Show answer</span>
                    <span className="hidden sm:group-open:inline">Hide</span>
                    <ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden="true" />
                  </span>
                </summary>
                <div className="px-5 pb-5 sm:pl-[4.25rem]">
                  <p className="read rounded-xl bg-blue-soft/50 px-4 py-3 text-[16px] text-ink-2">{d.a}</p>
                  <Link to={`/learn/${d.concept}`} className="mt-3 inline-flex items-center gap-1.5 text-[15px] font-bold text-blue-ink hover:underline">
                    Practise this idea or ask the tutor <ArrowRight className="size-4" aria-hidden="true" />
                  </Link>
                </div>
              </details>
            </li>
          ))}
        </ul>
      )}

      {data?.trends && (
        <Panel className="mt-8 px-6 py-5">
          <h2 className="flex items-center gap-2 text-[18px] font-extrabold"><Users className="size-5 text-grape" aria-hidden="true" /> Measured across this class</h2>
          <ul className="mt-3 space-y-2">
            {data.trends.map((t) => <li key={t.code} className="text-[15px] text-ink-2">{t.description} <span className="num font-semibold text-muted">· {t.learners} students</span></li>)}
          </ul>
        </Panel>
      )}
    </div>
  );
}
