'use client';

// The ONE button component (REDESIGN R1 §2.4). Renders the shared .btn
// classes from styles/system.css, so plain `className="btn btn-primary"`
// markup and <Button> look and behave identically.
//
// Variants: primary (blue) · secondary · tertiary · destructive · link · cta
// (green, nav "Sell free" only) · whatsapp.
// Sizes: sm · md · lg (touch target stays ≥ 44px on touch screens).
// States: hover, focus-visible, pressed (scale 0.97), loading (keeps width), disabled.

import * as React from 'react';
import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ButtonVariant = 'primary' | 'secondary' | 'tertiary' | 'destructive' | 'link' | 'whatsapp' | 'cta';
export type ButtonSize = 'sm' | 'md' | 'lg';

// Older shadcn-style names still accepted (default/outline/ghost/icon).
type LegacyVariant = 'default' | 'outline' | 'ghost';
type LegacySize = 'default' | 'icon';

const VARIANT_CLASS: Record<ButtonVariant | LegacyVariant, string> = {
  primary: 'btn-primary',
  default: 'btn-primary',
  secondary: 'btn-outline',
  outline: 'btn-outline',
  tertiary: 'btn-ghost',
  ghost: 'btn-ghost',
  destructive: 'btn-danger',
  link: 'btn-link',
  whatsapp: 'btn-whatsapp',
  cta: 'btn-cta',
};
const SIZE_CLASS: Record<ButtonSize | LegacySize, string> = {
  sm: 'btn-sm',
  md: '',
  default: '',
  lg: 'btn-lg',
  icon: 'btn-icon',
};

export function buttonClass({
  variant = 'primary',
  size = 'md',
  fullWidth,
  className,
}: {
  variant?: ButtonVariant | LegacyVariant;
  size?: ButtonSize | LegacySize;
  fullWidth?: boolean;
  className?: string;
} = {}) {
  return cn('btn', VARIANT_CLASS[variant], SIZE_CLASS[size], fullWidth && 'btn-block', className);
}
/** @deprecated use buttonClass — kept for older imports. */
export const buttonVariants = buttonClass;

interface CommonProps {
  variant?: ButtonVariant | LegacyVariant;
  size?: ButtonSize | LegacySize;
  fullWidth?: boolean;
  loading?: boolean;
  leadingIcon?: LucideIcon;
  trailingIcon?: LucideIcon;
}

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, CommonProps {}

function Inner({ leadingIcon: L, trailingIcon: T, size, children }: CommonProps & { children?: React.ReactNode }) {
  const px = size === 'lg' ? 20 : size === 'sm' ? 16 : 18;
  return (
    <>
      {L && <L size={px} aria-hidden />}
      {children}
      {T && <T size={px} aria-hidden />}
    </>
  );
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, fullWidth, loading, leadingIcon, trailingIcon, type = 'button', disabled, children, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={buttonClass({ variant, size, fullWidth, className })}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      <Inner leadingIcon={leadingIcon} trailingIcon={trailingIcon} size={size}>
        {children}
      </Inner>
    </button>
  );
});

/** A link that looks like a Button (internal routes use next/link). */
export function ButtonLink({
  href,
  className,
  variant,
  size,
  fullWidth,
  leadingIcon,
  trailingIcon,
  external,
  children,
  ...rest
}: CommonProps & {
  href: string;
  external?: boolean;
  className?: string;
  children?: React.ReactNode;
} & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href'>) {
  const cls = buttonClass({ variant, size, fullWidth, className });
  const inner = (
    <Inner leadingIcon={leadingIcon} trailingIcon={trailingIcon} size={size}>
      {children}
    </Inner>
  );
  if (external || /^https?:|^mailto:|^tel:/.test(href)) {
    return (
      <a href={href} className={cls} target={external ? '_blank' : undefined} rel={external ? 'noopener noreferrer' : undefined} {...rest}>
        {inner}
      </a>
    );
  }
  return (
    <Link href={href} className={cls} {...rest}>
      {inner}
    </Link>
  );
}

/** Icon-only button. Always has an accessible name (also used as its tooltip). */
export const IconButton = React.forwardRef<
  HTMLButtonElement,
  Omit<ButtonProps, 'leadingIcon' | 'trailingIcon' | 'children'> & { icon: LucideIcon; label: string }
>(function IconButton({ icon: I, label, className, variant = 'secondary', size = 'md', ...props }, ref) {
  return (
    <Button
      ref={ref}
      variant={variant}
      size={size}
      className={cn('btn-icon', className)}
      aria-label={label}
      title={label}
      {...props}
    >
      <I size={size === 'sm' ? 16 : 20} aria-hidden />
    </Button>
  );
});

/** Floating action button (map controls): round glass button with a tooltip. */
export const FAB = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { icon: LucideIcon; label: string; active?: boolean }
>(function FAB({ icon: I, label, className, active, type = 'button', ...props }, ref) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn('fab', active && 'is-active', className)}
      aria-label={label}
      aria-pressed={active}
      title={label}
      {...props}
    >
      <I size={20} aria-hidden />
    </button>
  );
});
