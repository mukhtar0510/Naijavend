'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Listing } from '@idevtenancy/shared';

const MAX_IMAGES = 5;
const MAX_BYTES = 5 * 1024 * 1024;
const MAX_VIDEO_BYTES = 60 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const VIDEO_TYPES = new Set(['video/mp4', 'video/webm', 'video/quicktime']);

const koboToInput = (kobo: number | null) => (kobo == null ? '' : String(kobo / 100));
// Stock is a count, not money — it must NOT go through the kobo conversion.
const countToInput = (n: number | null | undefined) => (n == null ? '' : String(n));

export function ListingEditor({ storeId, listing }: { storeId: string; listing?: Listing }) {
  const router = useRouter();
  const editing = listing != null;
  const [type, setType] = useState<'product' | 'service' | 'digital'>(listing?.type ?? 'product');
  const [title, setTitle] = useState(listing?.title ?? '');
  const [price, setPrice] = useState(koboToInput(listing?.price_kobo ?? null));
  const [compareAt, setCompareAt] = useState(koboToInput(listing?.compare_at_kobo ?? null));
  const [stock, setStock] = useState(countToInput(listing?.stock));
  const [description, setDescription] = useState(listing?.description ?? '');
  const [aiDescription, setAiDescription] = useState(listing?.ai_generated_description ?? false);
  const [tags, setTags] = useState<string[]>((listing as unknown as { tags?: string[] })?.tags ?? []);
  const [category, setCategory] = useState<string>((listing as unknown as { category?: string })?.category ?? '');
  const [aiSuggestion, setAiSuggestion] = useState<string | null>(null);
  const [imageUrls, setImageUrls] = useState<string[]>(listing?.image_urls ?? []);
  const [videoUrl, setVideoUrl] = useState<string | null>(listing?.video_url ?? null);
  const [videoName, setVideoName] = useState('');
  const [videoProgress, setVideoProgress] = useState<number | null>(null); // 0–100, null = not uploading
  const [aiBusy, setAiBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const videoInput = useRef<HTMLInputElement>(null);

  const priceKobo = Math.round((Number(price) || 0) * 100);
  const compareKobo = compareAt.trim() ? Math.round((Number(compareAt) || 0) * 100) : null;
  const stockCount = type === 'product' && stock.trim() ? Math.max(0, Math.round(Number(stock) || 0)) : null;

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);
    setSuccess(null);

    const room = MAX_IMAGES - imageUrls.length;
    if (room <= 0) {
      setError(`You can attach up to ${MAX_IMAGES} images per listing.`);
      return;
    }
    const picked = Array.from(files).slice(0, room);

    for (const f of picked) {
      if (!ALLOWED_TYPES.has(f.type)) {
        setError(`"${f.name}" is not a JPEG, PNG, WebP or GIF image.`);
        return;
      }
      if (f.size > MAX_BYTES) {
        setError(`"${f.name}" is larger than 5 MB.`);
        return;
      }
    }
    setUploading(true);
    try {
      // Upload all picked photos in parallel — serial uploads made 5 photos
      // take 5× as long on mobile connections.
      const uploaded = await Promise.all(
        picked.map(async (f) => {
          const form = new FormData();
          form.append('file', f);
          const res = await fetch('/api/listings/upload-image', { method: 'POST', body: form });
          const body = await res.json();
          if (!res.ok) throw new Error(body?.error?.message ?? `Could not upload "${f.name}".`);
          return body.url as string;
        }),
      );
      setImageUrls((prev) => [...prev, ...uploaded].slice(0, MAX_IMAGES));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  }

  function removeImage(url: string) {
    setImageUrls((prev) => prev.filter((u) => u !== url));
  }

  // Image tools: swap the photo in-place so the seller keeps their place.
  async function editPhoto(url: string, action: 'remove-background' | 'enhance') {
    setError(null);
    setSuccess(null);
    setBusy(true);
    try {
      const res = await fetch('/api/ai/image-edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, action }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error?.message ?? 'Could not edit that photo.');
      setImageUrls((prev) => prev.map((u) => (u === url ? (body.url as string) : u)));
      setSuccess(action === 'remove-background' ? 'Background replaced with white.' : 'Photo cleaned up.');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleVideo(file: File | null | undefined) {
    if (!file) return;
    setError(null);
    setSuccess(null);
    if (!VIDEO_TYPES.has(file.type)) {
      setError(`"${file.name}" is not an MP4, WebM or MOV video.`);
      return;
    }
    if (file.size > MAX_VIDEO_BYTES) {
      setError(`"${file.name}" is larger than 60 MB.`);
      return;
    }
    setUploading(true);
    setVideoProgress(file.size <= 4 * 1024 * 1024 ? null : 0);
    try {
      if (file.size <= 4 * 1024 * 1024) {
        // Small enough for the regular multipart endpoint.
        const form = new FormData();
        form.append('file', file);
        const res = await fetch('/api/listings/upload-image', { method: 'POST', body: form });
        const body = await res.json();
        if (!res.ok) throw new Error(body?.error?.message ?? 'Could not upload the video.');
        setVideoUrl(body.url as string);
      } else {
        // Over the serverless body limit — mint a signed upload URL and PUT
        // the file straight to Supabase Storage from the browser.
        const init = await fetch('/api/listings/upload-video', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contentType: file.type }),
        });
        const initBody = await init.json();
        if (!init.ok) throw new Error(initBody?.error?.message ?? 'Could not start the video upload.');
        await putWithProgress(initBody.signedUrl as string, file, file.type);
        setVideoUrl(initBody.publicUrl as string);
      }
      setVideoName(file.name);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUploading(false);
      setVideoProgress(null);
      if (videoInput.current) videoInput.current.value = '';
    }
  }

  function removeVideo() {
    setVideoUrl(null);
    setVideoName('');
    setVideoProgress(null);
    if (videoInput.current) videoInput.current.value = '';
  }

  // Small uploads go through the multipart endpoint; big ones are PUT directly
  // to Supabase Storage with live progress. Retries once on network failure —
  // flaky mobile connections were killing whole 60 MB uploads at 90%.
  async function putWithProgress(url: string, file: File, contentType: string): Promise<void> {
    for (let attempt = 0; attempt < 2; attempt++) {
      const ok = await new Promise<boolean>((resolve) => {
        const xhr = new XMLHttpRequest();
        xhr.open('PUT', url);
        xhr.setRequestHeader('Content-Type', contentType);
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) setVideoProgress(Math.round((e.loaded / e.total) * 100));
        };
        xhr.onload = () => resolve(xhr.status >= 200 && xhr.status < 300);
        xhr.onerror = () => resolve(false);
        xhr.ontimeout = () => resolve(false);
        xhr.send(file);
      });
      if (ok) return;
      if (attempt === 0) {
        // Brief pause, then retry the same signed URL (valid for a while).
        setVideoProgress(0);
        await new Promise((r) => setTimeout(r, 1200));
      } else {
        throw new Error('The video upload failed — check your connection and try again.');
      }
    }
  }

  async function draftWithAi() {
    setAiBusy(true);
    setError(null);
    try {
      // The photo matters more than the type: a seller who just shot the item
      // should get the whole listing from it (photo + rough notes → everything).
      const res = await fetch('/api/ai/draft-listing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hint: `${type === 'product' ? 'Product' : 'Service'}: ${title}. ${description}`,
          imageUrl: imageUrls[0] ?? null,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error?.message ?? 'Could not draft this listing.');
      const draft = body.draft ?? {};
      if (typeof draft.title === 'string' && draft.title.trim() && !title.trim()) {
        setTitle(draft.title.trim());
      }
      if (typeof draft.description === 'string' && draft.description.trim()) {
        setDescription(draft.description.trim());
        setAiDescription(true);
      }
      if (Array.isArray(draft.tags)) {
        const next = draft.tags.filter((t: unknown): t is string => typeof t === 'string').slice(0, 6);
        if (next.length) setTags(next);
      }
      if (typeof draft.category === 'string' && draft.category) setCategory(draft.category);
      const filled: string[] = [];
      if (typeof draft.title === 'string' && draft.title) filled.push('title');
      if (typeof draft.description === 'string' && draft.description) filled.push('description');
      if (Array.isArray(draft.tags) && draft.tags.length) filled.push('tags');
      if (typeof draft.category === 'string' && draft.category) filled.push('category');
      setAiSuggestion(
        filled.length
          ? `Drafted your ${filled.join(', ')} from ${body.usedPhoto ? 'the photo and' : ''} your notes — check them and edit.`
          : null
      );
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setAiBusy(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      if (editing) {
        const res = await fetch('/api/listings/update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            listingId: listing!.id,
            title,
            priceKobo,
            compareAtKobo: compareKobo,
            stock: stockCount,
            description,
            aiDescription,
            imageUrls,
            videoUrl,
            tags,
            category: category || undefined,
          }),
        });
        const body = await res.json();
        if (!res.ok) throw new Error(body?.error?.message ?? 'Could not save this listing.');
        setSuccess('Changes saved.');
        router.refresh();
        return;
      }

      const res = await fetch('/api/listings/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storeId,
          type,
          title,
          priceKobo,
          compareAtKobo: compareKobo,
          stock: stockCount,
          description,
          aiDescription,
          isBookable: type === 'service',
          imageUrls,
          videoUrl,
          tags,
          category: category || undefined,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error?.message ?? 'Could not add this listing.');
      if (body.duplicateOf) {
        setSuccess('Listing added — heads-up: it looks the same as an existing listing.');
      } else {
        setSuccess('Listing added.');
      }
      setTitle('');
      setPrice('');
      setCompareAt('');
      setStock('');
      setDescription('');
      setAiDescription(false);
      setImageUrls([]);
      setVideoUrl(null);
      setVideoName('');
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="card" style={{ maxWidth: 560 }}>
      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <div className="field">
        <label htmlFor={editing ? `ltype-${listing!.id}` : 'ltype'}>Type</label>
        <select
          id={editing ? `ltype-${listing!.id}` : 'ltype'}
          value={type}
          onChange={(e) => setType(e.target.value as 'product' | 'service' | 'digital')}
          disabled={editing}
        >
          <option value="product">Product</option>
          <option value="service">Service (bookable)</option>
          <option value="digital">Digital (ebook, code, file)</option>
        </select>
        {editing && <p className="hint">Type can't change after creation — orders and bookings depend on it.</p>}
      </div>
      <div className="field">
        <label htmlFor={editing ? `ltitle-${listing!.id}` : 'ltitle'}>Title</label>
        <input id={editing ? `ltitle-${listing!.id}` : 'ltitle'} type="text" value={title} onChange={(e) => setTitle(e.target.value)} required minLength={2} maxLength={160} placeholder={type === 'product' ? 'Ankara tote bag' : 'Knotless braids (medium)'} />
      </div>
      <div className="field">
        <label htmlFor={editing ? `lprice-${listing!.id}` : 'lprice'}>Price (₦)</label>
        <input id={editing ? `lprice-${listing!.id}` : 'lprice'} type="number" min={0} step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} required placeholder="15000" />
        <p className="hint">Stored as {priceKobo.toLocaleString()} kobo — never float currency.</p>
      </div>
      {type === 'product' && (
        <>
          <div className="field">
            <label htmlFor={editing ? `lcompare-${listing!.id}` : 'lcompare'}>Compare-at price (₦, optional)</label>
            <input id={editing ? `lcompare-${listing!.id}` : 'lcompare'} type="number" min={0} step="0.01" value={compareAt} onChange={(e) => setCompareAt(e.target.value)} placeholder="20000" />
            <p className="hint">
              {compareKobo && compareKobo > priceKobo
                ? `Shoppers see a strikethrough ₦${(compareKobo / 100).toLocaleString()} and a Sale badge (${Math.round((1 - priceKobo / compareKobo) * 100)}% off).`
                : 'Leave empty, or set higher than the price to show a strikethrough + Sale badge.'}
            </p>
          </div>
          <div className="field">
            <label htmlFor={editing ? `lstock-${listing!.id}` : 'lstock'}>Stock quantity (optional)</label>
            <input id={editing ? `lstock-${listing!.id}` : 'lstock'} type="number" min={0} step="1" value={stock} onChange={(e) => setStock(e.target.value)} placeholder="25" />
            <p className="hint">
              {stockCount === 0
                ? '0 = shown as Sold out until you restock.'
                : 'Shown as a Low stock warning at 3 or fewer. Leave empty for unlimited.'}
            </p>
          </div>
        </>
      )}
      <div className="field">
        <label htmlFor={editing ? `ldesc-${listing!.id}` : 'ldesc'}>Description</label>
        <textarea id={editing ? `ldesc-${listing!.id}` : 'ldesc'} value={description} onChange={(e) => { setDescription(e.target.value); setAiDescription(false); }} maxLength={2000} placeholder="What is it, who is it for, what makes it good?" />
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 8 }}>
          <button type="button" className="btn btn-outline btn-sm" onClick={draftWithAi} disabled={aiBusy || (title.trim().length < 2 && imageUrls.length === 0)}>
            {aiBusy ? 'Drafting…' : imageUrls.length ? '✍️ Draft from photo' : 'Draft with AI'}
          </button>
          {(title.trim().length >= 2 || imageUrls.length > 0) && (
            <span className="hint" style={{ margin: 0 }}>
              {imageUrls.length ? 'Uses your first photo + these notes.' : 'Needs only your notes.'}
            </span>
          )}
        </div>
        {aiSuggestion && <p className="hint">{aiSuggestion}</p>}
        {aiDescription && <p className="hint">AI-drafted — edit freely; changing the text clears the AI-assisted label.</p>}
        {tags.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }} aria-label="Search tags">
            {tags.map((t) => (
              <span key={t} className="badge" style={{ fontSize: 11.5 }}># {t}</span>
            ))}
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => setTags([])}
              title="Remove the drafted search tags"
            >
              Clear tags
            </button>
          </div>
        )}
      </div>

      <div className="field">
        <label htmlFor={editing ? `limages-${listing!.id}` : 'limages'}>Photos (up to {MAX_IMAGES})</label>
        <input
          id={editing ? `limages-${listing!.id}` : 'limages'}
          ref={fileInput}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          multiple
          onChange={(e) => handleFiles(e.target.files)}
          disabled={uploading || imageUrls.length >= MAX_IMAGES}
        />
        <p className="hint">JPEG, PNG, WebP or GIF · max 5 MB each · {imageUrls.length}/{MAX_IMAGES} added</p>

        {imageUrls.length > 0 && (
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 8 }}>
            {imageUrls.map((url, i) => (
              <div key={url} style={{ position: 'relative' }}>
                {/* eslint-disable-next-line @next/next/no-img-element -- local preview of uploaded file */}
                <img
                  src={url}
                  alt="Listing preview"
                  style={{ width: 76, height: 76, objectFit: 'cover', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}
                />
                <button
                  type="button"
                  aria-label="Remove image"
                  onClick={() => removeImage(url)}
                  style={{
                    position: 'absolute', top: -6, right: -6, width: 22, height: 22,
                    borderRadius: 999, border: '1px solid var(--border-strong)',
                    background: 'var(--surface)', cursor: 'pointer', lineHeight: 1, fontSize: 12,
                  }}
                >
                  ✕
                </button>
                <div style={{ display: 'grid', gap: 4, marginTop: 4, width: 76 }}>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    style={{ padding: '2px 4px', fontSize: 10.5, lineHeight: 1.2 }}
                    disabled={busy || uploading}
                    onClick={() => void editPhoto(url, 'remove-background')}
                    title="Swap the background for clean white"
                  >
                    🖼️ Remove bg
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    style={{ padding: '2px 4px', fontSize: 10.5, lineHeight: 1.2 }}
                    disabled={busy || uploading}
                    onClick={() => void editPhoto(url, 'enhance')}
                    title="Crop, straighten and brighten"
                  >
                    ✨ Clean up
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        {uploading && <p className="hint">Uploading…</p>}
      </div>

        {type === 'digital' && (
          <div className="field" style={{ background: 'var(--elevated-2)', padding: 12, borderRadius: 10, marginTop: 10 }}>
            <label htmlFor="digital-file">💳 File to sell (PDF, EPUB, ZIP, MP3, MP4…)</label>
            {editing && listing && (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const input = document.getElementById('digital-file') as HTMLInputElement | null;
                  const f = input?.files?.[0];
                  if (!f) return;
                  setBusy(true);
                  try {
                    const fd = new FormData();
                    fd.append('listingId', listing.id);
                    fd.append('file', f);
                    const res = await fetch('/api/listings/digital-upload', { method: 'POST', body: fd });
                    const body = await res.json();
                    if (!res.ok) throw new Error(body?.error?.message ?? 'Upload failed.');
                    setSuccess(`File attached: ${body.fileName}`);
                  } catch (err) {
                    setError((err as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
                style={{ display: 'grid', gap: 8 }}
              >
                <input id="digital-file" type="file" accept=".pdf,.epub,.mobi,.zip,.txt,.md,.csv,.doc,.docx,.mp3,.wav,.mp4" required />
                <p className="hint" style={{ margin: 0 }}>Max 50 MB. Buyers get a one-time secure download link after paying — the file itself is never publicly exposed.</p>
                <button type="submit" className="btn btn-primary btn-sm" disabled={busy}>
                  {busy ? 'Uploading…' : 'Attach file'}
                </button>
              </form>
            )}
            {editing && !listing && <p className="hint">Save the listing first, then attach the file.</p>}
            {!editing && (
              <p className="hint" style={{ margin: 0 }}>
                Create this listing first (click below), then come back and attach your file — the upload needs the listing id.
              </p>
            )}
          </div>
        )}

      <div className="field">
        <label htmlFor={editing ? `lvideo-${listing!.id}` : 'lvideo'}>Product video (optional — one)</label>
        <input
          id={editing ? `lvideo-${listing!.id}` : 'lvideo'}
          ref={videoInput}
          type="file"
          accept="video/mp4,video/webm,video/quicktime"
          onChange={(e) => handleVideo(e.target.files?.[0])}
          disabled={uploading || videoUrl !== null}
        />
        <p className="hint">MP4, WebM or MOV · max 60 MB · big videos upload directly to storage</p>
        {videoProgress !== null && (
          <div role="status" aria-label="Video upload progress" style={{ marginTop: 8 }}>
            <div style={{ height: 8, borderRadius: 999, background: 'var(--elevated-2)', overflow: 'hidden' }}>
              <div
                style={{
                  height: '100%',
                  width: `${videoProgress}%`,
                  borderRadius: 999,
                  background: 'var(--blue)',
                  transition: 'width 0.25s ease',
                }}
              />
            </div>
            <p className="hint" style={{ margin: '6px 0 0' }}>
              Uploading video… {videoProgress}%{videoProgress < 100 ? ' — keep this page open' : ''}
            </p>
          </div>
        )}
        {videoUrl && (
          <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
            <video src={videoUrl} controls style={{ width: 180, borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }} />
            <div>
              <p className="hint" style={{ margin: 0 }}>📹 {videoName || 'Video attached'}</p>
              <button type="button" className="btn btn-outline btn-sm" onClick={removeVideo} style={{ marginTop: 6 }}>Remove video</button>
            </div>
          </div>
        )}
      </div>

      <button className="btn btn-primary" type="submit" disabled={busy || uploading}>
        {busy ? (editing ? 'Saving…' : 'Adding…') : editing ? 'Save changes' : 'Add listing'}
      </button>
    </form>
  );
}
