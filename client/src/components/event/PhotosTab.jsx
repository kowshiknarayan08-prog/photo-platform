import { useEffect, useRef, useState } from 'react';
import { api } from '../../lib/api.js';
import { Alert, Badge, EmptyState, Spinner } from '../ui.jsx';
import ProtectedImage from '../ProtectedImage.jsx';

export default function PhotosTab({ eventId, isAdmin, onChanged }) {
  const [photos, setPhotos] = useState([]);
  const [scope, setScope] = useState('own');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState('');
  const [selecting, setSelecting] = useState(false);
  const fileRef = useRef(null);

  async function load() {
    setLoading(true);
    try {
      const data = await api.get(`/events/${eventId}/photos`);
      setPhotos(data.photos);
      setScope(data.scope);
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

  async function upload(e) {
    const files = [...(e.target.files || [])];
    if (files.length === 0) return;
    setUploading(true);
    setError('');
    setNotice('');
    try {
      const fd = new FormData();
      files.forEach((f) => fd.append('photos', f));
      const res = await api.postForm(`/events/${eventId}/photos`, fd);
      setNotice(
        `Uploaded ${res.summary.stored} of ${res.summary.received}` +
          (res.summary.failed ? ` — ${res.summary.failed} failed` : '')
      );
      await load();
      onChanged?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function toggleSelect(photo) {
    if (!isAdmin) return;
    setSelecting(true);
    try {
      await api.patch(`/events/${eventId}/photos/selection`, {
        photoIds: [photo.id],
        selected: !photo.isSelected,
      });
      setPhotos((ps) =>
        ps.map((p) => (p.id === photo.id ? { ...p, isSelected: !p.isSelected } : p))
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setSelecting(false);
    }
  }

  async function remove(photo) {
    if (!confirm(`Delete ${photo.filename}?`)) return;
    try {
      await api.del(`/photos/${photo.id}`);
      setPhotos((ps) => ps.filter((p) => p.id !== photo.id));
      onChanged?.();
    } catch (err) {
      setError(err.message);
    }
  }

  const selectedCount = photos.filter((p) => p.isSelected).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-slate-500">
          {scope === 'all' ? 'All team photos' : 'Your uploads'} · {photos.length} total
          {isAdmin && <> · {selectedCount} selected for gallery</>}
        </div>
        <label className="btn-primary cursor-pointer">
          {uploading ? <Spinner className="h-4 w-4" /> : 'Upload photos'}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={upload}
            disabled={uploading}
          />
        </label>
      </div>

      <Alert>{error}</Alert>
      {notice && <Alert kind="success">{notice}</Alert>}

      {loading ? (
        <div className="flex justify-center py-10">
          <Spinner className="h-6 w-6" />
        </div>
      ) : photos.length === 0 ? (
        <EmptyState title="No photos yet" hint="Use “Upload photos” to add images (you can pick several at once)." />
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {photos.map((p) => (
            <li
              key={p.id}
              className={`group relative overflow-hidden rounded-lg border ${
                p.isSelected ? 'border-brand-500 ring-2 ring-brand-200' : 'border-slate-200'
              }`}
            >
              <ProtectedImage
                path={p.url}
                alt={p.filename}
                className="aspect-square w-full object-cover"
              />
              <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-gradient-to-t from-black/60 to-transparent p-2 text-[11px] text-white">
                <span className="truncate">{p.filename}</span>
              </div>
              {p.isSelected && (
                <span className="absolute left-1.5 top-1.5">
                  <Badge tone="indigo">Selected</Badge>
                </span>
              )}
              <div className="absolute right-1.5 top-1.5 flex gap-1 opacity-0 transition group-hover:opacity-100">
                {isAdmin && (
                  <button
                    className="rounded bg-white/90 px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-white"
                    onClick={() => toggleSelect(p)}
                    disabled={selecting}
                  >
                    {p.isSelected ? 'Unselect' : 'Select'}
                  </button>
                )}
                <button
                  className="rounded bg-red-600/90 px-2 py-1 text-[11px] font-medium text-white hover:bg-red-600"
                  onClick={() => remove(p)}
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
