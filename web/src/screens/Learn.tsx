import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { AskChat } from "../components/learn/AskChat";
import { PracticePanel } from "../components/learn/PracticePanel";
import { LessonPanel } from "../components/learn/LessonPanel";
import { ConceptTile, ErrorNote, Loading, Stars } from "../components/ui";
import { api, type ConceptMastery, type Lesson } from "../lib/api";
import { STATUS, forYou } from "../lib/groups";
import { useLearner } from "../lib/learner";

// Loaded only on the learning page, so the voice SDK never weighs down the rest of the app.
const VoiceTutor = lazy(() => import("../voice/VoiceTutor"));

export default function Learn() {
  const { conceptId = "C1" } = useParams();
  const { learner } = useLearner();
  const learnerId = learner!.learner_id;
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [mastery, setMastery] = useState<ConceptMastery | null>(null);
  const [error, setError] = useState<unknown>(null);

  const refresh = useCallback(() => {
    api.mastery(learnerId).then((m) => setMastery(m.concepts.find((c) => c.concept === conceptId) ?? null)).catch(() => {});
  }, [learnerId, conceptId]);

  useEffect(() => {
    setLesson(null);
    setError(null);
    api.lesson(conceptId, learnerId).then(setLesson).catch(setError);
    refresh();
  }, [conceptId, learnerId, refresh]);

  if (error) return <div className="pt-10"><ErrorNote error={error} /></div>;
  if (!lesson) return <Loading what="the lesson" />;

  const topic = lesson.concept.topic_id === "SHM" ? "Simple Harmonic Motion" : "Optics";
  const st = mastery ? STATUS[mastery.status] : null;

  return (
    <div className="pb-10 pt-7">
      <p className="text-[14px] text-muted">
        <Link to="/topics" className="hover:text-ink">{topic}</Link> · <span className="num">{lesson.concept.concept_id}</span>
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-3">
        <span className="flex items-center gap-3.5">
          <ConceptTile id={lesson.concept.concept_id} size="lg" />
          <h1 className="text-[28px] font-extrabold leading-tight sm:text-[34px]">{lesson.concept.name}</h1>
        </span>
        {mastery && st && (
          <span title={mastery.status_reason} className="rounded-full border border-line bg-surface px-3 py-1">
            <Stars size="sm" step={mastery.enough_evidence ? st.step : 0}
              label={`${mastery.enough_evidence ? st.label : mastery.attempts ? "Keep practising" : "Not started"} · ${mastery.attempts} ${mastery.attempts === 1 ? "answer" : "answers"}`} />
          </span>
        )}
      </div>
      <p className="mt-2 max-w-3xl text-[15.5px] text-muted">{forYou(lesson.concept.learning_objective)}</p>

      <div className="mt-7 grid items-start gap-7 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-5">
          <LessonPanel lesson={lesson} />
          <Suspense fallback={null}>
            <VoiceTutor learnerId={learnerId} conceptId={conceptId} conceptName={lesson.concept.name} />
          </Suspense>
        </div>
        <PracticePanel learnerId={learnerId} conceptId={conceptId} onAnswered={refresh} />
      </div>
      <AskChat learnerId={learnerId} conceptId={conceptId} conceptName={lesson.concept.name}
        suggestions={lesson.doubts.slice(0, 3).map((d) => d.q)} />
    </div>
  );
}
