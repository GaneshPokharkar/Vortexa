import { ArrowRight, ClipboardCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ButtonLink, ConceptTile, ErrorNote, Loading, PageHeader, Stars } from "../components/ui";
import { api, type Concept, type ConceptMastery, type LearnerReport, type Topic } from "../lib/api";
import { STATUS, forYou } from "../lib/groups";
import { useLearner } from "../lib/learner";

function Meter({ m }: { m: ConceptMastery | undefined }) {
  const step = m ? STATUS[m.status].step : 0;
  const label = !m || !m.enough_evidence ? (m && m.attempts ? "Keep practising" : "Not started") : STATUS[m.status].label;
  return <Stars step={m && m.enough_evidence ? step : 0} label={label} />;
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
      <PageHeader title="What do you want to learn today?">Pick an idea. Start at the top of Simple Harmonic Motion; Optics is a bonus round.</PageHeader>

      {!data.report.pre && (
        <div className="mb-8 flex flex-wrap items-center gap-4 rounded-2xl border-2 border-sun/40 bg-sun-soft px-5 py-4">
          <ClipboardCheck className="size-6 text-sun" aria-hidden="true" />
          <p className="flex-1 text-[15px] font-semibold text-ink">Quick warm-up first! A short pre-test lets you see how much you grow.</p>
          <ButtonLink to="/assessment" variant="secondary">Take the pre-test</ButtonLink>
        </div>
      )}

      {data.topics.map((t) => (
        <section key={t.topic_id} className="mb-10" aria-labelledby={`t-${t.topic_id}`}>
          <div className="flex items-baseline gap-3">
            <h2 id={`t-${t.topic_id}`} className="text-[22px] font-extrabold">{t.title}</h2>
            <span className={`rounded-full px-2.5 py-0.5 text-[12.5px] font-bold ${t.primary ? "bg-blue-soft text-blue-ink" : "bg-grape-soft text-grape"}`}>{t.primary ? "Main topic" : "Bonus"}</span>
          </div>
          <p className="mt-1 text-[15px] text-muted">{t.description}</p>
          <ul className="mt-4 grid gap-3">
            {data.concepts.filter((c) => c.topic_id === t.topic_id).map((c) => {
              const m = byId.get(c.concept_id);
              return (
                <li key={c.concept_id}>
                  <Link to={`/learn/${c.concept_id}`} className="grid items-center gap-x-5 gap-y-3 rounded-2xl border border-line bg-surface px-5 py-4 shadow-[0_2px_0_var(--ll-line)] transition-[border-color,transform] hover:-translate-y-0.5 hover:border-blue md:grid-cols-[auto_minmax(0,1fr)_13rem_auto]">
                    <ConceptTile id={c.concept_id} />
                    <span>
                      <span className="block text-[17px] font-bold text-ink">{c.name}</span>
                      <span className="mt-0.5 block text-[14px] text-muted">{forYou(c.learning_objective)}</span>
                    </span>
                    <Meter m={m} />
                    <span className="inline-flex items-center gap-1.5 text-[15px] font-bold text-blue-ink">
                      {m && m.attempts ? "Keep going" : "Let's go"} <ArrowRight className="size-4" aria-hidden="true" />
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
