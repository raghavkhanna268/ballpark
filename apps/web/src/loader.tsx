/**
 * The loading screen: a radar sweeps round while the rocket bobs in the middle, over "Fuelling…". Screen readers
 * hear what is loading instead.
 */
export function Loader({ label }: { label: string }) {
  return (
    <div className="loader" role="status">
      <div className="radar" aria-hidden="true">
        <svg viewBox="-20 -66 40 80">
          <path className="loader-flame" d="M-5 -6 Q0 12 5 -6Z" />
          <path className="loader-fin" d="M-9 -22 L-17 -2 L-9 -7Z M9 -22 L17 -2 L9 -7Z" />
          <path className="loader-body" d="M0 -58 C12 -46 12 -24 9 -6 L-9 -6 C-12 -24 -12 -46 0 -58Z" />
          <circle className="loader-window" cx="0" cy="-36" r="4.5" />
        </svg>
      </div>
      <p aria-hidden="true">Fuelling…</p>
      <span className="sr">{label}</span>
    </div>
  );
}
