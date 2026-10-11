import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import SimSlot from "../components/SimSlot";
import { ErrorNote, Loading, Panel, btnPrimary, btnQuiet } from "../components/ui";
import { api, type Card, type Concept } from "../lib/api";
import { ZONE_COLOR } from "../lib/meta";

export default function Learn() {
  const { conceptId = "C1" } = useParams();
  const [params] = useSearchParams();
  const cardId = params.get("card") ?? `${conceptId}-K`;
  const [card, setCard] = useState<Card | null>(null);
  const [concept, setConcept] = useState<Concept | null>(null);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    let live = true;
    setCard(null);
    setError(null);
    Promise.all([api.card(cardId), api.concepts()])
      .then(([c, all]) => {
        if (!live) return;
        setCard(c as Card);
        setConcept(all.find((x) => x.concept_id === conceptId) ?? null);
      })
      .catch((e) => live && setError(e));
    return () => {
      live = false;
    };
  }, [cardId, conceptId]);

  if (error) return <ErrorNote error={error} />;
  if (!card || !concept) return <Loading what="the card" />;

  const remediation = card.code !== null;
  return (
    <div className="pt-6">
      <Link to="/" className="text-sm text-muted hover:text-text">Back to path</Link>
      <div className="mt-4 flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h1 className="text-3xl font-semibold">{concept.name}</h1>
        <span className="text-sm" style={{ color: ZONE_COLOR[concept.zone] }}>{concept.zone}</span>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <Panel className="p-6 sm:p-8">
          {remediation ? <RemediationBody card={card} /> : <ConceptBody card={card} />}
          <SourceLine card={card} />
        </Panel>

        <div className="flex flex-col gap-4">
          <SimSlot conceptId={conceptId} />
          <div className="flex flex-wrap gap-3">
            <Link to={`/practice/${conceptId}`} className={btnPrimary}>Practise this concept</Link>
            {remediation && <Link to={`/learn/${conceptId}`} className={btnQuiet}>Read the main idea</Link>}
          </div>
        </div>
      </div>
    </div>
  );
}

function ConceptBody({ card }: { card: Card }) {
  return (
    <>
      <p className="font-head text-xl leading-relaxed sm:text-2xl">{card.statement}</p>
      {card.analogy && <p className="mt-5 max-w-prose text-muted">{card.analogy}</p>}
      {card.steps.length > 0 && (
        <>
          <h2 className="mt-8 text-base font-semibold">Reasoning, step by step</h2>
          <ol className="mt-3 space-y-3">
            {card.steps.map((s, i) => (
              <li key={i} className="flex gap-3">
                <span className="num mt-0.5 text-sm text-teal">{i + 1}</span>
                <span className="max-w-prose">{s}</span>
              </li>
            ))}
          </ol>
        </>
      )}
      {card.worked_example && (
        <>
          <h2 className="mt-8 text-base font-semibold">Worked example</h2>
          <p className="mt-3 max-w-prose rounded-lg border-l-2 border-amber bg-bg/50 px-4 py-3">{card.worked_example}</p>
        </>
      )}
    </>
  );
}

function RemediationBody({ card }: { card: Card }) {
  return (
    <>
      <p className="text-sm text-coral">A common wrong idea</p>
      <blockquote className="mt-2 font-head text-xl leading-relaxed sm:text-2xl">“{card.wrong_idea}”</blockquote>
      {card.why_it_feels_right && (
        <>
          <h2 className="mt-8 text-base font-semibold">Why it feels right</h2>
          <p className="mt-2 max-w-prose text-muted">{card.why_it_feels_right}</p>
        </>
      )}
      <h2 className="mt-6 text-base font-semibold">Why it's wrong</h2>
      <p className="mt-2 max-w-prose">{card.why_wrong}</p>
      <h2 className="mt-6 text-base font-semibold">The idea that works</h2>
      <p className="mt-2 max-w-prose rounded-lg border-l-2 border-green bg-bg/50 px-4 py-3">{card.statement}</p>
      {card.sim_moment && <p className="mt-6 text-sm text-muted">See it happen: {card.sim_moment}</p>}
    </>
  );
}

function SourceLine({ card }: { card: Card }) {
  const verified = card.verify_flags.length === 0;
  return (
    <p className="mt-8 border-t border-line pt-4 text-xs text-muted">
      Source: card <span className="num text-text">{card.card_id}</span>{" "}
      {verified ? <span className="text-green">(verified)</span> : <span className="text-amber">(draft, awaiting teacher check)</span>}
    </p>
  );
}
