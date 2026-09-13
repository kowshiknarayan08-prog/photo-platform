import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { Alert, Badge, PageLoader } from '../components/ui.jsx';
import PhotosTab from '../components/event/PhotosTab.jsx';
import MembersTab from '../components/event/MembersTab.jsx';
import GalleryTab from '../components/event/GalleryTab.jsx';

const TABS = [
  { key: 'photos', label: 'Photos' },
  { key: 'members', label: 'Team' },
  { key: 'gallery', label: 'Gallery' },
];

export default function EventPage() {
  const { eventId } = useParams();
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('photos');

  const load = useCallback(async () => {
    try {
      const data = await api.get(`/events/${eventId}`);
      setEvent(data.event);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <PageLoader />;
  if (error) return <Alert>{error}</Alert>;
  if (!event) return null;

  const selectedCount = event.photosSelected ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <Link to="/" className="text-sm text-brand-700">
          &larr; All events
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold text-slate-900">{event.name}</h1>
          {event.gallery?.isPublished ? (
            <Badge tone="green">Gallery published</Badge>
          ) : event.gallery ? (
            <Badge tone="amber">Gallery draft</Badge>
          ) : (
            <Badge>No gallery</Badge>
          )}
        </div>
        {event.description && <p className="mt-1 text-sm text-slate-500">{event.description}</p>}
        <div className="mt-2 flex gap-4 text-xs text-slate-400">
          <span>{event._count?.photos ?? 0} photos</span>
          <span>{event._count?.members ?? 0} team members</span>
          {isAdmin && <span>{selectedCount} selected for gallery</span>}
        </div>
      </div>

      <div className="flex gap-1 border-b border-slate-200">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition ${
              tab === t.key
                ? 'border-brand-600 text-brand-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'photos' && (
        <PhotosTab eventId={eventId} isAdmin={isAdmin} onChanged={load} />
      )}
      {tab === 'members' && (
        <MembersTab eventId={eventId} isAdmin={isAdmin} onChanged={load} />
      )}
      {tab === 'gallery' && (
        <GalleryTab eventId={eventId} isAdmin={isAdmin} selectedCount={selectedCount ?? 0} />
      )}
    </div>
  );
}
