// Placeholder: the Predict → Watch simulations plug in here in a later phase.
export default function SimSlot({ conceptId }: { conceptId: string }) {
  return (
    <div
      data-concept={conceptId}
      className="grid aspect-[4/3] place-items-center rounded-2xl border border-dashed border-line bg-bg/40 p-6 text-center"
    >
      <div>
        <svg viewBox="0 0 120 40" className="mx-auto mb-3 w-28 opacity-50" aria-hidden="true">
          <path d="M0 20 Q15 2 30 20 T60 20 T90 20 T120 20" fill="none" stroke="var(--muted)" strokeWidth="2" />
        </svg>
        <p className="text-sm text-muted">The simulation for this concept appears here.</p>
      </div>
    </div>
  );
}
