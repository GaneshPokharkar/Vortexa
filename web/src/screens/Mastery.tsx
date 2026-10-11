import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ErrorNote, Loading, Panel } from "../components/ui";
import { api, type Concept, type ConceptMastery } from "../lib/api";
import { ZONE_COLOR, pct } from "../lib/meta";
import { useLearner } from "../learner";

const MASTERY_LINE = 0.95;

export default function Mastery() {
  const { learner, name } = useLearner();
  const [rows, setRows] = useState<(ConceptMastery & { c: Concept })[] | null>(null);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    let live = true;
    setRows(null);
    Promise.all([api.concepts(), api.mastery(learner)])
      .then(([concepts, m]) => {
        if (!live) return;
        const byId = new Map(concepts.map((c) => [c.concept_id, c]));
        setRows(m.concepts.map((x) => ({ ...x, c: byId.get(x.concept)! })));
      })
      .catch((e) => live && setError(e));
    return () => {
      live = false;
    };
  }, [learner]);

  if (error) return <ErrorNote error={error} />;
  if (!rows) return <Loading what="mastery" />;

  const practised = rows.filter((r) => r.history.length > 0);
  return (
    <div className="pt-6">
      <h1 className="text-3xl font-semibold sm:text-4xl">{name}'s mastery</h1>
      <p className="mt-2 max-w-2xl text-muted">
        P(L) is how likely WaveLoop thinks each idea is learned. A concept counts as mastered at {pct(MASTERY_LINE)}, after at
        least three answers on two different questions, with the last one right and no confirmed wrong idea.
      </p>

      <Panel className="mt-8 divide-y divide-line">
        {rows.map((r) => (
          <ConceptRow key={r.concept} r={r} />
        ))}
      </Panel>

      <Panel className="mt-6 p-5 sm:p-6">
        <h2 className="text-lg font-semibold">P(L) over time</h2>
        {practised.length === 0 ? (
          <p className="mt-3 text-muted">
            No answers yet. <Link to="/practice" className="text-teal underline-offset-4 hover:underline">Answer a question</Link> to
            start the chart.
          </p>
        ) : (
          <HistoryChart rows={practised} />
        )}
      </Panel>
    </div>
  );
}

function ConceptRow({ r }: { r: ConceptMastery & { c: Concept } }) {
  const color = ZONE_COLOR[r.c.zone];
  const confirmed = Object.entries(r.misconceptions).filter(([, s]) => s === "CONFIRMED").map(([k]) => k);
  return (
    <div className="grid items-center gap-x-6 gap-y-2 px-5 py-4 sm:grid-cols-[minmax(0,15rem)_minmax(0,1fr)_24rem]">
      <Link to={`/learn/${r.concept}`} className="rounded-md hover:text-teal">
        <span className="num mr-2 text-sm text-muted">{r.concept}</span>
        {r.c.name}
      </Link>

      <div className="relative h-2.5 rounded-full bg-bg" role="img" aria-label={`${r.c.name}: ${pct(r.p_learned)} learned`}>
        <div className="h-full rounded-full transition-[width] duration-500" style={{ width: pct(r.p_learned), background: color }} />
        <div className="absolute -top-1 h-4.5 w-px bg-muted" style={{ left: pct(MASTERY_LINE) }} title="Mastery line" />
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
        <span className="num w-12 text-right text-base text-text">{pct(r.p_learned)}</span>
        <span><span className="num text-text">{r.attempts}</span> answers</span>
        <span><span className="num text-text">{r.distinct_items}</span> questions</span>
        {r.mastered && <span className="text-green">Mastered</span>}
        {confirmed.length > 0 && <span className="text-coral">Wrong idea {confirmed.join(", ")}</span>}
      </div>
    </div>
  );
}

function HistoryChart({ rows }: { rows: (ConceptMastery & { c: Concept })[] }) {
  // One line per practised concept; x is the answer number within that concept.
  const longest = Math.max(...rows.map((r) => r.history.length));
  const data = Array.from({ length: longest + 1 }, (_, i) => {
    const point: Record<string, number> = { n: i };
    for (const r of rows) {
      const series = [0.25, ...r.history];
      if (i < series.length) point[r.concept] = series[i];
    }
    return point;
  });

  return (
    <div className="mt-4 h-72">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: -8 }}>
          <CartesianGrid stroke="#24314d" strokeDasharray="2 6" vertical={false} />
          <XAxis dataKey="n" stroke="#8a97ad" tickLine={false} axisLine={false} allowDecimals={false}
            tick={{ fontFamily: "JetBrains Mono", fontSize: 12 }} label={{ value: "answer", position: "insideBottomRight", offset: -4, fill: "#8a97ad", fontSize: 12 }} />
          <YAxis domain={[0, 1]} ticks={[0, 0.25, 0.5, 0.75, 1]} stroke="#8a97ad" tickLine={false} axisLine={false}
            tickFormatter={(v: number) => `${v * 100}%`} tick={{ fontFamily: "JetBrains Mono", fontSize: 12 }} />
          <ReferenceLine y={MASTERY_LINE} stroke="#7bd389" strokeDasharray="4 4" />
          <Tooltip
            contentStyle={{ background: "#131c2e", border: "1px solid #24314d", borderRadius: 10, color: "#e6edf7" }}
            labelFormatter={(n) => `After answer ${n}`}
            formatter={(v, key) => [pct(Number(v)), String(key)]}
          />
          {rows.map((r) => (
            <Line key={r.concept} type="monotone" dataKey={r.concept} stroke={ZONE_COLOR[r.c.zone]} strokeWidth={2}
              dot={{ r: 3, strokeWidth: 0, fill: ZONE_COLOR[r.c.zone] }} connectNulls={false} isAnimationActive={false} />
          ))}
        </LineChart>
      </ResponsiveContainer>
      <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted">
        {rows.map((r) => (
          <span key={r.concept} className="flex items-center gap-2">
            <span className="h-0.5 w-4" style={{ background: ZONE_COLOR[r.c.zone] }} />
            <span className="num">{r.concept}</span> {r.c.name}
          </span>
        ))}
        <span className="flex items-center gap-2">
          <span className="h-0 w-4 border-t border-dashed border-green" /> Mastery line
        </span>
      </div>
    </div>
  );
}
