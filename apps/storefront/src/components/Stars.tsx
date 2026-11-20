import { Star } from 'lucide-react';

export function Stars({ value, showNumeric = true }: { value: number; showNumeric?: boolean }) {
  const rounded = Math.round(value);
  return (
    <span className="stars" aria-label={`Rated ${value.toFixed(1)} out of 5`}>
      {Array.from({ length: 5 }, (_, i) => (
        <Star key={i} size={15} className={i < rounded ? undefined : 'off'} fill="currentColor" aria-hidden />
      ))}
      {showNumeric && <span className="muted" style={{ marginLeft: 6 }}>{value.toFixed(1)}</span>}
    </span>
  );
}
