// Brand-accurate social icons, inline SVG (no emoji, no icon library dependency).
// All accept className/size; use currentColor so store themes apply automatically.
interface IconProps {
  className?: string;
  size?: number;
}

const base = (size?: number) => ({
  width: size ?? 18,
  height: size ?? 18,
  viewBox: '0 0 24 24',
  fill: 'currentColor',
  'aria-hidden': true as const,
});

export function InstagramIcon({ className, size }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M12 2.2c3.2 0 3.6 0 4.9.07 1.2.06 1.8.25 2.2.42.6.22 1 .48 1.4.9.4.4.7.8.9 1.4.17.4.36 1 .42 2.2.06 1.3.07 1.7.07 4.9s0 3.6-.07 4.9c-.06 1.2-.25 1.8-.42 2.2-.22.6-.48 1-.9 1.4-.4.4-.8.7-1.4.9-.4.17-1 .36-2.2.42-1.3.06-1.7.07-4.9.07s-3.6 0-4.9-.07c-1.2-.06-1.8-.25-2.2-.42a3.8 3.8 0 0 1-1.4-.9 3.8 3.8 0 0 1-.9-1.4c-.17-.4-.36-1-.42-2.2C2.2 15.6 2.2 15.2 2.2 12s0-3.6.07-4.9c.06-1.2.25-1.8.42-2.2.22-.6.48-1 .9-1.4.4-.4.8-.7 1.4-.9.4-.17 1-.36 2.2-.42C8.4 2.2 8.8 2.2 12 2.2Zm0 1.8c-3.14 0-3.5 0-4.74.07-1.1.05-1.7.24-2.1.4-.5.2-.86.44-1.24.82-.38.38-.62.74-.82 1.24-.16.4-.35 1-.4 2.1C2.6 9.07 2.6 9.43 2.6 12s0 2.93.1 4.17c.05 1.1.24 1.7.4 2.1.2.5.44.86.82 1.24.38.38.74.62 1.24.82.4.16 1 .35 2.1.4 1.24.08 1.6.09 4.74.09s3.5-.01 4.74-.09c1.1-.05 1.7-.24 2.1-.4.5-.2.86-.44 1.24-.82.38-.38.62-.74.82-1.24.16-.4.35-1 .4-2.1.08-1.24.09-1.6.09-4.74s-.01-3.5-.09-4.74c-.05-1.1-.24-1.7-.4-2.1a3.3 3.3 0 0 0-.82-1.24 3.3 3.3 0 0 0-1.24-.82c-.4-.16-1-.35-2.1-.4C15.5 4 15.14 4 12 4Zm0 3.06a4.94 4.94 0 1 1 0 9.88 4.94 4.94 0 0 1 0-9.88Zm0 8.15a3.21 3.21 0 1 0 0-6.42 3.21 3.21 0 0 0 0 6.42Zm6.3-8.35a1.15 1.15 0 1 1-2.3 0 1.15 1.15 0 0 1 2.3 0Z" />
    </svg>
  );
}

export function XIcon({ className, size }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M18.9 2.1h3.68l-8.04 9.2L24 23.05h-7.41l-5.8-7.58-6.64 7.58H.47l8.6-9.83L0 2.1h7.59l5.24 6.93L18.9 2.1Zm-1.29 18.72h2.04L6.49 4.19H4.3l13.31 16.63Z" />
    </svg>
  );
}

export function FacebookIcon({ className, size }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.09 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.7 4.53-4.7 1.31 0 2.68.24 2.68.24v2.97h-1.51c-1.49 0-1.95.93-1.95 1.89v2.26h3.32l-.53 3.5h-2.8V24C19.62 23.1 24 18.1 24 12.07Z" />
    </svg>
  );
}

export function TikTokIcon({ className, size }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M17.53 0h-3.9v15.77a3.32 3.32 0 0 1-3.32 3.32 3.32 3.32 0 0 1-3.32-3.32 3.32 3.32 0 0 1 3.32-3.32c.34 0 .68.05 1 .16V8.63a7.36 7.36 0 0 0-1-.07A7.4 7.4 0 0 0 2.9 15.97a7.4 7.4 0 0 0 7.41 7.4 7.4 7.4 0 0 0 7.4-7.4V7.75a9.35 9.35 0 0 0 5.47 1.76V5.6a5.6 5.6 0 0 1-5.65-5.56V0Z" />
    </svg>
  );
}

export function YouTubeIcon({ className, size }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M23.5 6.19a3.02 3.02 0 0 0-2.12-2.14C19.5 3.55 12 3.55 12 3.55s-7.5 0-9.38.5A3.02 3.02 0 0 0 .5 6.19C0 8.07 0 12 0 12s0 3.93.5 5.81a3.02 3.02 0 0 0 2.12 2.14c1.88.5 9.38.5 9.38.5s7.5 0 9.38-.5a3.02 3.02 0 0 0 2.12-2.14C24 15.93 24 12 24 12s0-3.93-.5-5.81ZM9.55 15.57V8.43L15.82 12l-6.27 3.57Z" />
    </svg>
  );
}

export function WhatsAppIcon({ className, size }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.25-.46-2.39-1.47-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.5 0 1.47 1.07 2.9 1.22 3.1.15.2 2.1 3.2 5.1 4.49.71.3 1.27.49 1.7.63.72.23 1.37.2 1.88.12.58-.09 1.76-.72 2.01-1.42.25-.7.25-1.29.17-1.42-.07-.13-.27-.2-.57-.35ZM12.05 21.79h-.01a9.87 9.87 0 0 1-5.03-1.38l-.36-.21-3.74.98 1-3.65-.24-.37a9.86 9.86 0 0 1-1.51-5.26c0-5.45 4.44-9.88 9.9-9.88a9.83 9.83 0 0 1 7 2.9 9.83 9.83 0 0 1 2.89 7c0 5.45-4.44 9.87-9.9 9.87Zm8.42-18.29A11.8 11.8 0 0 0 12.04 0C5.5 0 .16 5.34.16 11.9c0 2.1.55 4.14 1.59 5.95L.06 24l6.3-1.65a11.88 11.88 0 0 0 5.68 1.45h.01c6.55 0 11.89-5.34 11.89-11.9 0-3.18-1.24-6.16-3.47-8.4Z" />
    </svg>
  );
}

export function TelegramIcon({ className, size }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M23.91 3.79 20.3 20.84c-.25 1.21-.98 1.5-1.94.94l-5.39-3.97-2.6 2.5c-.3.3-.55.56-1.1.56-.72 0-.6-.27-.84-.95L6.3 13.7l-5.45-1.7c-1.18-.35-1.19-1.16.26-1.75l21.26-8.2c.97-.43 1.9.24 1.53 1.73Z" />
    </svg>
  );
}

/** Copy-link glyph for the share bar. */
export function LinkIcon({ className, size }: IconProps) {
  return (
    <svg {...base(size)} className={className} fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}

/** Native-share glyph (system share sheet). */
export function ShareIcon({ className, size }: IconProps) {
  return (
    <svg {...base(size)} className={className} fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v13" />
      <path d="m7 8 5-5 5 5" />
      <path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" />
    </svg>
  );
}

/** Check glyph (copied state). */
export function CheckIcon({ className, size }: IconProps) {
  return (
    <svg {...base(size)} className={className} fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round">
      <path d="m4.5 12.5 5 5 10-11" />
    </svg>
  );
}
