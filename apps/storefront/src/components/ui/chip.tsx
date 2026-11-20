'use client';

// The ONE chip system (REDESIGN R1 §2.4): categories and filters everywhere
// (landing, Discover, map, dashboard). Same height, radius, icon slot,
// selected style, count badge and keyboard behaviour. Styles: styles/system.css.

import * as React from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CategoryIcon } from '@/lib/categories';

export interface ChipProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  label: React.ReactNode;
  selected?: boolean;
  icon?: LucideIcon;
  /** Shortcut for a category chip: shows that category's icon in its colour. */
  category?: string;
  count?: number;
}

export const Chip = React.forwardRef<HTMLButtonElement, ChipProps>(function Chip(
  { label, selected, icon: I, category, count, className, type = 'button', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn('chip', selected && 'is-active', className)}
      aria-pressed={selected}
      {...props}
    >
      {category ? <CategoryIcon category={category} size={16} /> : I ? <I size={16} aria-hidden /> : null}
      <span>{label}</span>
      {count != null && <span className="chip-count">{count}</span>}
    </button>
  );
});

/** Static status / info label. Never colour alone: pass an icon or clear text. */
export function Badge({
  tone = 'neutral',
  icon: I,
  children,
  className,
}: {
  tone?: 'neutral' | 'primary' | 'info' | 'success' | 'warning' | 'danger';
  icon?: LucideIcon;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span className={cn('badge', tone !== 'neutral' && `badge-${tone}`, className)}>
      {I && <I size={13} aria-hidden />}
      {children}
    </span>
  );
}

/** Small removable-looking tag (e.g. product keywords). */
export function Tag({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn('badge', className)}>{children}</span>;
}

/** One-of-N switch (e.g. Walk / Okada / Drive, Streets / Satellite). */
export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: Array<{ value: T; label: React.ReactNode; icon?: LucideIcon }>;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div className="nv-map-toggle" role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          className={cn('nv-map-toggle-btn', value === o.value && 'is-active')}
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
        >
          {o.icon && <o.icon size={14} aria-hidden />} {o.label}
        </button>
      ))}
    </div>
  );
}

/** On/off chip toggle. */
export function Toggle({
  on,
  onChange,
  label,
  icon,
}: {
  on: boolean;
  onChange: (on: boolean) => void;
  label: React.ReactNode;
  icon?: LucideIcon;
}) {
  return <Chip label={label} icon={icon} selected={on} onClick={() => onChange(!on)} />;
}
