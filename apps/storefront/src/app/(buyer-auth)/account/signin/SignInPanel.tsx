'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, BadgeCheck, Heart, Package, ShieldCheck, Sparkles, Zap } from 'lucide-react';
import { GoogleSignInButton } from '@/components/GoogleSignInButton';
import { InAppBrowserWarning } from '@/components/InAppBrowserWarning';
import { RefCapture } from '@/components/RefCapture';

export type AuthMode = 'signin' | 'create';

const CREATE_PERKS = [
  { icon: Package, text: 'Every order and booking tracked in one place' },
  { icon: Heart, text: 'Saved stores and favourites, synced across devices' },
  { icon: BadgeCheck, text: 'Review the stores you actually bought from' },
];

const SIGNIN_PERKS = [
  { icon: Package, text: 'Pick up where you left off — orders, bookings, chats' },
  { icon: Sparkles, text: 'Ask the AI about any order or product' },
  { icon: Heart, text: 'Your saved stores are already waiting' },
];

/**
 * Buyer auth panel: one Google button covers both sign-in and sign-up, so the
 * tabs change the promise and the label rather than inventing a second flow
 * the backend does not have. Deep links (?next=…, ?mode=create) are honoured.
 */
export function SignInPanel({ next, initialMode }: { next: string; initialMode: AuthMode }) {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const perks = mode === 'create' ? CREATE_PERKS : SIGNIN_PERKS;

  return (
    <div className="nv-auth-card">
      <div className="nv-auth-tabs" role="tablist" aria-label="Sign in or create an account">
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'signin'}
          className={`nv-auth-tab${mode === 'signin' ? ' is-active' : ''}`}
          onClick={() => setMode('signin')}
        >
          Sign in
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'create'}
          className={`nv-auth-tab${mode === 'create' ? ' is-active' : ''}`}
          onClick={() => setMode('create')}
        >
          Create account
        </button>
      </div>

      <div className="nv-auth-head">
        <h1>{mode === 'signin' ? 'Welcome back to Kwaravend' : 'Create your free Kwaravend account'}</h1>
        <p>
          {mode === 'signin'
            ? 'One tap and you are in. No password to forget, no forms to fill.'
            : 'Shop from verified Nigerian stores, track every order and keep your favourites everywhere.'}
        </p>
      </div>

      <ul className="nv-auth-perks">
        {perks.map(({ icon: Icon, text }) => (
          <li key={text}>
            <span className="nv-auth-perk-ico" aria-hidden>
              <Icon size={15} />
            </span>
            {text}
          </li>
        ))}
      </ul>

      <RefCapture />
      <InAppBrowserWarning />

      <GoogleSignInButton
        next={next}
        label={mode === 'create' ? 'Create account with Google' : 'Continue with Google'}
      />

      <p className="nv-auth-note">
        {mode === 'create'
          ? 'Your account is created automatically the first time you continue with Google.'
          : 'New here? Switch to “Create account” — it takes the same five seconds.'}
      </p>

      <div className="nv-auth-trust">
        <span>
          <ShieldCheck size={14} aria-hidden /> Secure by Google
        </span>
        <span>
          <Zap size={14} aria-hidden /> Takes 5 seconds
        </span>
        <span>
          <BadgeCheck size={14} aria-hidden /> No spam, ever
        </span>
      </div>

      <div className="nv-auth-foot">
        <p>
          Own a business? <Link href="/dashboard/signin">Seller sign in</Link>
        </p>
        <p>
          By continuing you agree to our <Link href="/legal/terms">Terms</Link> and{' '}
          <Link href="/legal/privacy">Privacy Policy</Link>.
        </p>
        <Link href="/discover" className="nv-auth-guest">
          <ArrowLeft size={14} aria-hidden /> Keep browsing as a guest
        </Link>
      </div>
    </div>
  );
}
