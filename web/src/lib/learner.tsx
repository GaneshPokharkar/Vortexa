import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { api, type Learner, type Modes } from "./api";

// Anonymous by default: the only thing stored in the browser is which learner id this device is using.
const KEY = "learnloop.learner";

type Ctx = {
  learner: Learner | null;
  modes: Modes | null;
  startNew: () => Promise<Learner>;
  useDemo: (l: Learner) => void;
  leave: () => void;
};
const LearnerCtx = createContext<Ctx | null>(null);

function read(): Learner | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Learner) : null;
  } catch {
    return null;
  }
}

function write(l: Learner | null) {
  try {
    if (l) localStorage.setItem(KEY, JSON.stringify(l));
    else localStorage.removeItem(KEY);
  } catch {
    /* private mode: the session still works for this tab */
  }
}

export function LearnerProvider({ children }: { children: ReactNode }) {
  const [learner, setLearner] = useState<Learner | null>(read);
  const [modes, setModes] = useState<Modes | null>(null);

  useEffect(() => {
    api.modes().then(setModes).catch(() => setModes(null));
  }, []);

  const set = useCallback((l: Learner | null) => {
    setLearner(l);
    write(l);
  }, []);

  const startNew = useCallback(async () => {
    const l = await api.createLearner();
    set(l);
    return l;
  }, [set]);

  return (
    <LearnerCtx.Provider value={{ learner, modes, startNew, useDemo: set, leave: () => set(null) }}>
      {children}
    </LearnerCtx.Provider>
  );
}

export function useLearner() {
  const v = useContext(LearnerCtx);
  if (!v) throw new Error("useLearner outside LearnerProvider");
  return v;
}

/** Display name: anonymous learners are "you"; demo learners are labelled. */
export function learnerName(l: Learner | null): string {
  if (!l) return "Guest";
  return l.is_demo ? l.display_name : "You";
}
