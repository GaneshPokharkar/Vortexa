import { Play } from "lucide-react";
import { useRef, useState } from "react";

// Files live in web/public/films: film<n>-<voice>.mp4 (+ .vtt subtitles) and film<n>.jpg posters.
const FILMS = [
  { title: "Two pendulums, one period", topic: "Oscillations · SHM", length: "1:03",
    line: "A 5° swing and a 15° swing finish ten swings together. Then a spring: zero speed, biggest acceleration." },
  { title: "What a wave carries", topic: "Mechanical waves", length: "0:54",
    line: "The rope only moves up and down. Shaking faster or harder never makes the wave travel faster." },
  { title: "Beats: the difference, not the sum", topic: "Sound · beats", length: "0:46",
    line: "256 Hz and 260 Hz give 4 beats a second, heard at 258 Hz." },
  { title: "Mirrors, lenses and trapped light", topic: "Ray optics", length: "1:02",
    line: "Half a lens still makes the whole image, a real image needs no screen, and light past 42° can't leave glass." },
  { title: "Two slits and a third polaroid", topic: "Wave optics", length: "0:53",
    line: "Closer slits spread the fringes apart, and a 45° polaroid brings light back between crossed ones." },
];

const VOICES = [
  { id: "en", label: "English" },
  { id: "hi", label: "हिंदी" },
  { id: "mr", label: "मराठी" },
] as const;
type Voice = (typeof VOICES)[number]["id"];

// ponytail: one MP4 per voice (3× the video bytes) instead of syncing a separate audio track to a silent video.
export function Films() {
  const [film, setFilm] = useState(0);
  const [voice, setVoice] = useState<Voice>("en");
  const video = useRef<HTMLVideoElement>(null);
  const resume = useRef<{ t: number; play: boolean } | null>(null); // applied once the new file has loaded
  const [picked, setPicked] = useState(false); // nothing downloads before the first play or pick

  const pickVoice = (v: Voice) => {
    const el = video.current;
    if (el) resume.current = { t: el.currentTime, play: !el.paused };
    setPicked(true);
    setVoice(v);
  };
  const pickFilm = (i: number) => {
    resume.current = { t: 0, play: true };
    setPicked(true);
    setFilm(i);
  };

  const f = FILMS[film];
  const base = `/films/film${film + 1}`;
  return (
    <section className="border-t border-line py-14" aria-labelledby="films">
      <h2 id="films" className="text-[22px] font-semibold">See it in a minute</h2>
      <p className="mt-2 max-w-2xl text-[16px] text-muted">
        Five short films on the ideas students most often get wrong. Predict, watch, explain, in English, Hindi or Marathi.
      </p>

      <div className="mt-8 grid items-start gap-8 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <div>
          <video
            key={film}
            ref={video}
            preload={picked ? "metadata" : "none"}
            src={`${base}-${voice}.mp4`}
            poster={`${base}.jpg`}
            controls
            playsInline
            className="aspect-video w-full rounded-2xl border border-line bg-ink"
            onLoadedMetadata={(e) => {
              const r = resume.current;
              resume.current = null;
              if (!r) return;
              e.currentTarget.currentTime = r.t;
              if (r.play) e.currentTarget.play().catch(() => {}); // a blocked autoplay just leaves it paused
            }}
          >
            {VOICES.map((v) => (
              <track key={v.id} kind="subtitles" src={`${base}-${v.id}.vtt`} srcLang={v.id} label={v.label} />
            ))}
          </video>

          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-3">
            <div role="group" aria-label="Voice" className="inline-flex rounded-lg border border-line-strong bg-surface p-1">
              {VOICES.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  lang={v.id}
                  aria-pressed={voice === v.id}
                  onClick={() => pickVoice(v.id)}
                  className={`rounded-md px-3.5 py-1.5 text-[15px] font-medium transition-colors ${
                    voice === v.id ? "bg-blue text-white" : "text-ink-2 hover:bg-surface-2"
                  }`}
                >
                  {v.label}
                </button>
              ))}
            </div>
            <p className="text-[14px] text-muted">Subtitles in all three languages: use the CC button.</p>
          </div>

          <h3 className="mt-5 text-[18px] font-semibold">{f.title}</h3>
          <p className="mt-1 text-[15.5px] text-ink-2">{f.line}</p>
        </div>

        <ol className="grid gap-2" aria-label="Films">
          {FILMS.map((x, i) => (
            <li key={x.title}>
              <button
                type="button"
                aria-current={i === film ? "true" : undefined}
                onClick={() => pickFilm(i)}
                className={`grid w-full grid-cols-[112px_minmax(0,1fr)] items-center gap-3 rounded-xl border p-2 text-left transition-colors ${
                  i === film ? "border-blue bg-blue-soft" : "border-line bg-surface hover:border-line-strong"
                }`}
              >
                <span className="relative">
                  <img src={`/films/film${i + 1}.jpg`} alt="" loading="lazy" className="aspect-video w-full rounded-lg object-cover" />
                  <Play className="absolute inset-0 m-auto size-6 rounded-full bg-ink/70 p-1.5 text-white" aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="block font-medium text-ink">{x.title}</span>
                  <span className="mt-0.5 block text-[13.5px] text-muted">
                    {x.topic} · <span className="num">{x.length}</span>
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
