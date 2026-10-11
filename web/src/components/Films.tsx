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

/** Which film explains which idea (0-based film index). Films on other topics are only on the landing page. */
export const FILMS_FOR_CONCEPT: Record<string, number[]> = { C2: [0], C3: [0], C6: [3], C7: [3] };

// ponytail: one MP4 per voice (3× the video bytes) instead of syncing a separate audio track to a silent video.
export function Films({ only }: { only?: number[] } = {}) {
  const list = only ?? FILMS.map((_, i) => i);
  const [film, setFilm] = useState(list[0]);
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
    <figure className="rounded-2xl border border-line bg-surface p-4 sm:p-5" aria-labelledby="films">
      <figcaption id="films" className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 px-1 text-[14px] text-muted">
        <span>See it in a minute: predict, watch, explain</span>
        <span className="num text-[13px]">
          {list.indexOf(film) + 1} / {list.length}
        </span>
      </figcaption>

      <video
        key={film}
        ref={video}
        preload={picked ? "metadata" : "none"}
        src={`${base}-${voice}.mp4`}
        poster={`${base}.jpg`}
        controls
        playsInline
        className="mt-3 aspect-video w-full rounded-xl bg-ink"
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

      <div className="mt-4 flex flex-wrap items-start justify-between gap-x-4 gap-y-3 px-1">
        <div className="min-w-0 flex-1 basis-56">
          <p className="read text-[19px] leading-snug text-ink">{f.title}</p>
          <p className="mt-1 text-[13.5px] text-muted">
            {f.topic} · <span className="num">{f.length}</span>
          </p>
        </div>
        <div role="group" aria-label="Voice" className="inline-flex shrink-0 rounded-lg border border-line-strong bg-surface p-1">
          {VOICES.map((v) => (
            <button
              key={v.id}
              type="button"
              lang={v.id}
              aria-pressed={voice === v.id}
              onClick={() => pickVoice(v.id)}
              className={`rounded-md px-3 py-1 text-[14.5px] font-medium transition-colors ${
                voice === v.id ? "bg-blue text-white" : "text-ink-2 hover:bg-surface-2"
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>
      <p className="mt-2 px-1 text-[14.5px] text-ink-2">{f.line}</p>

      {list.length > 1 && <ol className="mt-4 grid grid-cols-5 gap-2" aria-label="Films">
        {list.map((i) => [FILMS[i], i] as const).map(([x, i]) => (
          <li key={x.title}>
            <button
              type="button"
              aria-current={i === film ? "true" : undefined}
              aria-label={`${x.title}, ${x.topic}, ${x.length}`}
              title={x.title}
              onClick={() => pickFilm(i)}
              className={`relative block w-full overflow-hidden rounded-lg border-2 transition-colors ${
                i === film ? "border-blue" : "border-transparent opacity-75 hover:opacity-100"
              }`}
            >
              <img src={`/films/film${i + 1}.jpg`} alt="" loading="lazy" className="aspect-video w-full object-cover" />
              <span className="num absolute bottom-1 left-1 rounded bg-ink/75 px-1.5 text-[11px] leading-4 text-white">{i + 1}</span>
            </button>
          </li>
        ))}
      </ol>}
      <p className="mt-3 border-t border-line px-1 pt-3 text-[13px] text-muted">
        English, Hindi or Marathi voice. Subtitles in all three from the CC button.
      </p>
    </figure>
  );
}
