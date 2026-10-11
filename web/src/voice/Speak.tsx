import { Square, Volume2 } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { SPEECH_LINES } from "./speechLines";

// Pre-recorded tutor lines (ElevenLabs v4, voice Sanika), served from /speech. Playing them costs no credits
// and works offline; only the live voice tutor (VoiceTutor) talks to ElevenLabs at run time.

export type LineId = keyof typeof SPEECH_LINES;

/** The clip for `id`, but only while its recorded English still matches the text on screen; else null. */
export function recorded(id: string, text: string): LineId | null {
  return id in SPEECH_LINES && SPEECH_LINES[id as LineId].en === text ? (id as LineId) : null;
}

type Lang = "en" | "mr";
const KEY = "learnloop.speechLang";
const subs = new Set<() => void>();
let lang: Lang = (() => {
  try {
    return localStorage.getItem(KEY) === "mr" ? "mr" : "en";
  } catch {
    return "en";
  }
})();

function setLang(l: Lang) {
  lang = l;
  try {
    localStorage.setItem(KEY, l);
  } catch {
    /* private mode: the choice just isn't remembered */
  }
  subs.forEach((f) => f());
}
const useLang = () =>
  useSyncExternalStore((f) => {
    subs.add(f);
    return () => { subs.delete(f); };
  }, () => lang);

let playing: HTMLAudioElement | null = null; // one voice at a time across the page

/** Plays one recorded line in the chosen language. `iconOnly` for tight spots like the feedback headline. */
export function Speak({ id, iconOnly = false }: { id: LineId; iconOnly?: boolean }) {
  const l = useLang();
  const audio = useRef<HTMLAudioElement | null>(null);
  const [on, setOn] = useState(false);
  useEffect(() => () => audio.current?.pause(), [id, l]); // a new line or language stops the old one

  const toggle = () => {
    if (on) return audio.current?.pause();
    playing?.pause();
    const a = new Audio(`/speech/${id}-${l}.mp3`);
    a.onpause = a.onended = () => setOn(false);
    audio.current = playing = a;
    setOn(true);
    a.play().catch(() => setOn(false));
  };

  const Icon = on ? Square : Volume2;
  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={on}
      aria-label={iconOnly ? (on ? "Stop" : "Listen") : undefined}
      className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[14.5px] text-blue-ink hover:bg-surface-2"
    >
      <Icon className="size-4" aria-hidden="true" />
      {!iconOnly && (on ? "Stop" : "Listen")}
    </button>
  );
}

/** English / Marathi choice for every Speak button on the page; remembered on this device. */
export function SpeechLang() {
  const l = useLang();
  return (
    <span role="group" aria-label="Voice language" className="inline-flex rounded-lg border border-line p-0.5 text-[13.5px]">
      {(["en", "mr"] as const).map((x) => (
        <button
          key={x}
          type="button"
          lang={x}
          aria-pressed={l === x}
          onClick={() => setLang(x)}
          className={`rounded-md px-2 py-0.5 ${l === x ? "bg-blue-soft font-medium text-blue-ink" : "text-ink-2 hover:bg-surface-2"}`}
        >
          {x === "en" ? "English" : "मराठी"}
        </button>
      ))}
    </span>
  );
}
