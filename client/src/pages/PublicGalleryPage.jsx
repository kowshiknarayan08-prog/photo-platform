import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { api, apiUrl, absoluteUrl } from '../lib/api.js';
import { Alert, Spinner } from '../components/ui.jsx';

export default function PublicGalleryPage() {
  const { slug } = useParams();

  const [meta, setMeta] = useState(null);
  const [status, setStatus] = useState('loading'); // loading | pin | ready | notfound
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [token, setToken] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [lightbox, setLightbox] = useState(null);

  useEffect(() => {
    api
      .get(`/public/galleries/${slug}`, { auth: false })
      .then((data) => {
        setMeta(data.gallery);
        setStatus('pin');
      })
      .catch((err) => {
        setError(err.message);
        setStatus('notfound');
      });
  }, [slug]);

  const loadPhotos = useCallback(
    async (t) => {
      const res = await fetch(apiUrl(`/public/galleries/${slug}/photos`), {
        headers: { Authorization: `Bearer ${t}` },
      });
      if (!res.ok) throw new Error('Could not load photos');
      const data = await res.json();
      setPhotos(data.photos);
    },
    [slug]
  );

  async function submitPin(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const data = await api.post(
        `/public/galleries/${slug}/verify`,
        { pin },
        { auth: false }
      );
      setToken(data.token);
      await loadPhotos(data.token);
      setStatus('ready');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (status === 'loading') {
    return (
      <div className="grid min-h-screen place-items-center">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  if (status === 'notfound') {
    return (
      <div className="grid min-h-screen place-items-center bg-slate-50 px-4">
        <div className="max-w-sm text-center">
          <p className="text-4xl font-bold text-slate-300">Gallery unavailable</p>
          <p className="mt-3 text-slate-600">
            This link is invalid, has been unpublished, or has expired.
          </p>
        </div>
      </div>
    );
  }

  if (status === 'pin') {
    return (
      <div className="grid min-h-screen place-items-center bg-slate-50 px-4">
        <div className="w-full max-w-sm">
          <div className="mb-6 text-center">
            <h1 className="text-xl font-semibold text-slate-900">{meta.title}</h1>
            <p className="mt-1 text-sm text-slate-500">Enter the PIN you were given to view this gallery.</p>
          </div>
          <form onSubmit={submitPin} className="card space-y-4">
            <Alert>{error}</Alert>
            <div>
              <label className="label" htmlFor="pin">Gallery PIN</label>
              <input
                id="pin"
                className="input text-center text-lg tracking-[0.5em]"
                inputMode="numeric"
                autoFocus
                maxLength={8}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                required
              />
            </div>
            <button className="btn-primary w-full" disabled={busy || pin.length < 4}>
              {busy ? 'Checking…' : 'View gallery'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // status === 'ready'
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-4">
          <h1 className="text-lg font-semibold text-slate-900">{meta.title}</h1>
          <p className="text-sm text-slate-500">{photos.length} photos</p>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        {photos.length === 0 ? (
          <p className="text-slate-500">This gallery has no photos.</p>
        ) : (
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
            {photos.map((p) => (
              <li key={p.id}>
                <button
                  className="block w-full overflow-hidden rounded-lg border border-slate-200 bg-white"
                  onClick={() => setLightbox(p)}
                >
                  <img
                    src={absoluteUrl(p.url)}
                    alt={p.filename}
                    loading="lazy"
                    className="aspect-square w-full object-cover transition hover:opacity-90"
                  />
                </button>
              </li>
            ))}
          </ul>
        )}
      </main>

      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setLightbox(null)}
        >
          <img
            src={absoluteUrl(lightbox.url)}
            alt={lightbox.filename}
            className="max-h-full max-w-full rounded-lg"
          />
        </div>
      )}
    </div>
  );
}
