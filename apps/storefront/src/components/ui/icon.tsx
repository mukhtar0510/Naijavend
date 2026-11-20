// The ONE icon wrapper (REDESIGN R1 §2.3). Lucide only; sizes 16/20/24/32;
// consistent stroke; decorative (aria-hidden) unless given a label.
import type { LucideIcon } from 'lucide-react';

export function Icon({
  icon: I,
  size = 20,
  label,
  className,
}: {
  icon: LucideIcon;
  size?: 16 | 20 | 24 | 32;
  /** Only when the icon carries meaning on its own (no visible text beside it). */
  label?: string;
  className?: string;
}) {
  return (
    <I
      size={size}
      strokeWidth={size >= 24 ? 1.75 : 2}
      className={className}
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? 'img' : undefined}
      focusable={false}
    />
  );
}
