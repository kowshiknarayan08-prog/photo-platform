import { useEffect, useState } from 'react';
import { api } from '../../lib/api.js';
import { Alert, Badge, PageLoader } from '../ui.jsx';

export default function GalleryTab({ eventId, isAdmin, selectedCount }) {
  const [gallery, setGallery] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ title: '', pin: '' });

  async function load() {
    setLoading(true);
    try {
      const data = await api.get(`/events/${eventId}/gallery`);
      setGallery(data.gallery);
      if (data.gallery) setForm((f) => ({ ...f, title: data.gallery.title }));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  async function saveDraft(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      let data;
      if (!gallery) {
        // Create from the current selection.
        data = await api.put(`/events/${eventId}/gallery`, {
          title: form.title,
          pin: form.pin,
        });
      } else {
        // Update title, optionally the PIN, and re-sync photos to the
        // current selection (photoIds: [] -> server uses isSelected photos).
        const body = { title: form.title, photoIds: [] };
        if (form.pin) body.pin = form.pin;
        data = await api.patch(`/galleries/${gallery.id}`, body);
      }
      setGallery(data.gallery);
      setForm((f) => ({ ...f, pin: '' }));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function publish() {
    setBusy(true);
    setError('');
    try {
      const data = await api.post(`/galleries/${gallery.id}/publish`);
      setGallery(data.gallery);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function unpublish() {
    setBusy(true);
    try {
      const data = await api.post(`/galleries/${gallery.id}/unpublish`);
      setGallery(data.gallery);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function syncSelection() {
    setBusy(true);
    setError('');
    try {
      const data = await api.patch(`/galleries/${gallery.id}`, { photoIds: [] });
      // photoIds: [] -> controller falls back to current isSelected photos
      setGallery(data.gallery);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <PageLoader />;

  const shareUrl = gallery ? `${window.location.origin}/gallery/${gallery.slug}` : '';

  return (
    <div className="space-y-5">
      <Alert>{error}</Alert>

      {!isAdmin && !gallery && (
        <p className="text-sm text-slate-500">No gallery has been created for this event yet.</p>
      )}

      {!isAdmin && gallery && (
        <div className="card space-y-2">
          <div className="flex items-center gap-2">
            <h3 className="font-medium">{gallery.title}</h3>
            {gallery.isPublished ? <Badge tone="green">Published</Badge> : <Badge tone="amber">Draft</Badge>}
          </div>
          <p className="text-sm text-slate-500">{gallery.photoCount ?? gallery.photos?.length ?? 0} photos in the gallery.</p>
        </div>
      )}

      {isAdmin && (
        <>
          <div className="card space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-slate-900">
                {gallery ? 'Gallery settings' : 'Create the gallery'}
              </h3>
              {gallery &&
                (gallery.isPublished ? (
                  <Badge tone="green">Published</Badge>
                ) : (
                  <Badge tone="amber">Draft</Badge>
                ))}
            </div>

            <p className="text-sm text-slate-500">
              {selectedCount} photo{selectedCount === 1 ? '' : 's'} currently selected on the Photos tab.
              {gallery && ' Saving re-syncs the gallery to your current selection.'}
            </p>

            <form onSubmit={saveDraft} className="grid gap-3 sm:grid-cols-3 sm:items-end">
              <div className="sm:col-span-2">
                <label className="label">Gallery title</label>
                <input
                  className="input"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  required
                />
              </div>
              <div>
                <label className="label">{gallery ? 'New PIN' : 'PIN'} (4–8 digits)</label>
                <input
                  className="input"
                  inputMode="numeric"
                  pattern="\d{4,8}"
                  placeholder={gallery ? 'leave to keep current' : '482917'}
                  value={form.pin}
                  onChange={(e) => setForm((f) => ({ ...f, pin: e.target.value }))}
                  required={!gallery}
                />
              </div>
              <button className="btn-primary sm:col-span-3 sm:w-auto" disabled={busy || (!gallery && selectedCount === 0)}>
                {gallery ? 'Save & re-sync selection' : 'Create gallery'}
              </button>
            </form>
          </div>

          {gallery && (
            <div className="card space-y-4">
              <div>
                <label className="label">Shareable link</label>
                <div className="flex gap-2">
                  <input readOnly className="input font-mono text-xs" value={shareUrl} />
                  <button
                    type="button"
                    className="btn-secondary shrink-0"
                    onClick={() => navigator.clipboard?.writeText(shareUrl)}
                  >
                    Copy
                  </button>
                </div>
                <p className="mt-1 text-xs text-slate-400">
                  Customers open this link and enter the PIN — no account needed.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <button className="btn-secondary" onClick={syncSelection} disabled={busy}>
                  Re-sync photos from selection
                </button>
                {gallery.isPublished ? (
                  <button className="btn-danger" onClick={unpublish} disabled={busy}>
                    Unpublish
                  </button>
                ) : (
                  <button className="btn-primary" onClick={publish} disabled={busy}>
                    Publish gallery
                  </button>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
