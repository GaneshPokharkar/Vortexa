import { createContext, useContext, useState, type ReactNode } from "react";

// Two fictional personas for the demo. Switching learner is the only thing stored in the browser.
export const PERSONAS = [
  { id: "asha", name: "Asha" },
  { id: "ben", name: "Ben" },
] as const;
export type LearnerId = (typeof PERSONAS)[number]["id"];

const KEY = "waveloop.learner";
const Ctx = createContext<{ learner: LearnerId; name: string; setLearner: (id: LearnerId) => void } | null>(null);

function stored(): LearnerId {
  try {
    const v = localStorage.getItem(KEY);
    return PERSONAS.some((p) => p.id === v) ? (v as LearnerId) : "asha";
  } catch {
    return "asha";
  }
}

export function LearnerProvider({ children }: { children: ReactNode }) {
  const [learner, set] = useState<LearnerId>(stored);
  const setLearner = (id: LearnerId) => {
    set(id);
    try {
      localStorage.setItem(KEY, id);
    } catch {
      /* private mode: switching still works for this tab */
    }
  };
  const name = PERSONAS.find((p) => p.id === learner)!.name;
  return <Ctx.Provider value={{ learner, name, setLearner }}>{children}</Ctx.Provider>;
}

export function useLearner() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useLearner outside LearnerProvider");
  return v;
}
