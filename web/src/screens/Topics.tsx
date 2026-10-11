import { ArrowRight, ClipboardCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ButtonLink, ErrorNote, Loading, PageHeader } from "../components/ui";
import { api, type Concept, type ConceptMastery, type LearnerReport, type Topic } from "../lib/api";
import { STATUS } from "../lib/groups";
import { useLearner } from "../lib/learner";

function Meter({ m }: { m: ConceptMastery | undefined }) {
  const step = m ? STATUS[m.status].step : 0;
  const label = !m || !m.enough_evidence ? (m && m.attempts ? "Not enough evidence yet" : "Not assessed") : STATUS[m.status].label;
  return (
    <span className="flex items-center gap-2.5" aria-label={`Status: ${label}`}>
      <span className="flex gap-1" aria-hidden="true">
        {[1, 2, 3].map((s) => (
          <span key={s} className="h-1.5 w-6 rounded-full" style={{ background: s <= step ? STATUS.demonstrated.color : "var(--ll-line)" }} />
        ))}
      </span>
      <span className="text-[13.5px] text-muted">{label}</span>
    </span>
  );
}

export default function Topics() {
  const { learner } = useLearner();
  const [data, setData] = useState<{ topics: Topic[]; concepts: Concept[]; mastery: ConceptMastery[]; report: LearnerReport } | null>(null);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    const id = learner!.learner_id;
    Promise.all([api.topics(), api.concepts(), api.mastery(id), api.learnerReport(id)])
      .then(([topics, concepts, m, report]) => setData({ topics, concepts, mastery: m.concepts, report }))
      .catch(setError);
  }, [learner]);

  if (error) return <div className="pt-10"><ErrorNote error={error} /></div>;
  if (!data) return <Loading what="topics" />;
  const byId = new Map(data.mastery.map((m) => [m.concept, m]));

  return (
    <div>
      <PageHeader title="Choose a concept">Start with Simple Harmonic Motion; Optics uses the same tutor as an extension.</PageHeader>

      {!data.report.pre && (
        <div className="mb-8 flex flex-wrap items-center gap-4 rounded-xl border border-blue/25 bg-blue-soft/50 px-5 py-4">
          <ClipboardCheck className="size-5 text-blue-ink" aria-hidden="true" />
          <p className="flex-1 text-[15px] text-ink">Take the short pre-test first, so your report can show what changed after practice.</p>
          <ButtonLink to="/assessment" variant="secondary">Take the pre-test</ButtonLink>
        </div>
      )}

      {data.topics.map((t) => (
        <section key={t.topic_id} className="mb-10" aria-labelledby={`t-${t.topic_id}`}>
          <div className="flex items-baseline gap-3">
            <h2 id={`t-${t.topic_id}`} className="text-[20px] font-semibold">{t.title}</h2>
            <span className="text-[13.5px] text-muted">{t.primary ? "Main module" : "Extension"}</span>
          </div>
          <p className="mt-1 text-[15px] text-muted">{t.description}</p>
          <ul className="mt-4 divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
            {data.concepts.filter((c) => c.topic_id === t.topic_id).map((c) => {
              const m = byId.get(c.concept_id);
              return (
                <li key={c.concept_id}>
                  <Link to={`/learn/${c.concept_id}`} className="grid items-center gap-x-6 gap-y-2 px-5 py-4 hover:bg-bg md:grid-cols-[minmax(0,1fr)_14rem_auto]">
                    <span>
                      <span className="flex items-baseline gap-2.5">
                        <span className="num text-[13.5px] text-muted">{c.concept_id}</span>
                        <span className="text-[16px] font-medium text-ink">{c.name}</span>
                      </span>
                      <span className="mt-1 block text-[14px] text-muted">{c.learning_objective}</span>
                    </span>
                    <Meter m={m} />
                    <span className="inline-flex items-center gap-1.5 text-[14.5px] font-medium text-blue-ink">
                      {m && m.attempts ? "Continue" : "Start"} <ArrowRight className="size-4" aria-hidden="true" />
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
