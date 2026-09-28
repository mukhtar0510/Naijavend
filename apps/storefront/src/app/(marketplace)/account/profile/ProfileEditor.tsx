'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

interface Props {
  email: string;
  initialName: string;
  initialPhone: string;
  initialAvatarUrl: string | null;
  memberSince: string | null;
}

const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('') || '🙂';

// Self-service profile editor: avatar upload (2 MB JPEG/PNG/WebP), name and
// phone. Saves go to /api/account/profile (RLS-scoped to the signed-in
// customer); avatars upload first to /api/account/avatar, then the returned
// URL is persisted via the profile PATCH.
export function ProfileEditor({ email, initialName, initialPhone, initialAvatarUrl, memberSince }: Props) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [phone, setPhone] = useState(initialPhone);
  const [avatarUrl, setAvatarUrl] = useState(initialAvatarUrl);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [flash, setFlash] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const dirty = name !== initialName || phone !== initialPhone;

  async function pickAvatar(file: File) {
    setUploading(true);
    setFlash(null);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/api/account/avatar', { method: 'POST', body: form });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error?.message ?? 'Upload failed.');
      const url = body.url as string;
      const save = await fetch('/api/account/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ avatarUrl: url }),
      });
      const saveBody = await save.json();
      if (!save.ok) throw new Error(saveBody?.error?.message ?? 'Could not save the avatar.');
      setAvatarUrl(url);
      setFlash({ kind: 'ok', text: 'Photo updated.' });
      router.refresh();
    } catch (err) {
      setFlash({ kind: 'err', text: (err as Error).message });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function removeAvatar() {
    setUploading(true);
    setFlash(null);
    try {
      const res = await fetch('/api/account/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ avatarUrl: '' }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error?.message ?? 'Could not remove the photo.');
      setAvatarUrl(null);
      setFlash({ kind: 'ok', text: 'Photo removed.' });
      router.refresh();
    } catch (err) {
      setFlash({ kind: 'err', text: (err as Error).message });
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    setBusy(true);
    setFlash(null);
    try {
      const res = await fetch('/api/account/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName: name, phone }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error?.message ?? 'Could not save your profile.');
      setFlash({ kind: 'ok', text: 'Profile saved.' });
      router.refresh();
    } catch (err) {
      setFlash({ kind: 'err', text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card prof-card">
      <div className="prof-head">
        <div className="prof-avatar-wrap">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="prof-avatar" src={avatarUrl} alt="Your profile photo" />
          ) : (
            <span className={`prof-avatar prof-avatar-fallback${name !== initialName ? ' is-live' : ''}`}>
              {initialsOf(name || email)}
            </span>
          )}
          {uploading && <span className="prof-avatar-spin" aria-label="Uploading" />}
        </div>
        <div className="prof-head-main">
          <strong className="prof-name">{name || 'Your profile'}</strong>
          <span className="muted prof-email">{email}</span>
          {memberSince && <span className="muted prof-since">Member since {memberSince}</span>}
          <div className="prof-avatar-actions">
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void pickAvatar(f);
              }}
            />
            <button type="button" className="btn btn-outline btn-sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
              {avatarUrl ? 'Change photo' : '📷 Upload photo'}
            </button>
            {avatarUrl && (
              <button type="button" className="btn btn-outline btn-sm prof-remove" onClick={removeAvatar} disabled={uploading}>
                Remove
              </button>
            )}
          </div>
        </div>
      </div>

      {flash && <div className={`alert ${flash.kind === 'ok' ? 'alert-success' : 'alert-error'}`}>{flash.text}</div>}

      <div className="field">
        <label htmlFor="pf-name">Full name</label>
        <input
          id="pf-name"
          type="text"
          value={name}
          maxLength={80}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Amaka Obi"
        />
      </div>

      <div className="field">
        <label htmlFor="pf-phone">Phone number</label>
        <input
          id="pf-phone"
          type="tel"
          inputMode="tel"
          value={phone}
          maxLength={20}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="e.g. 08031234567"
        />
        <p className="hint">Sellers use this to reach you about orders and bookings. Never shown publicly.</p>
      </div>

      <div className="prof-actions">
        <button type="button" className="btn btn-primary" onClick={save} disabled={busy || (!dirty && name === initialName)}>
          {busy ? 'Saving…' : 'Save changes'}
        </button>
        {dirty && (
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => {
              setName(initialName);
              setPhone(initialPhone);
              setFlash(null);
            }}
            disabled={busy}
          >
            Discard
          </button>
        )}
      </div>
    </div>
  );
}
