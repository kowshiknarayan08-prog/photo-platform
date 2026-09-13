import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { Alert, Badge, EmptyState, PageLoader } from '../components/ui.jsx';

export default function DashboardPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', description: '' });
  const [creating, setCreating] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const data = await api.get('/events');
      setEvents(data.events);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function createEvent(e) {
    e.preventDefault();
    setCreating(true);
    setError('');
    try {
      await api.post('/events', form);
      setForm({ name: '', description: '' });
      setShowForm(false);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  }

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">
            {isAdmin ? 'Your events' : 'Events assigned to you'}
          </h1>
          <p className="text-sm text-slate-500">
            {isAdmin
              ? 'Create an event, add your team, then curate and publish a gallery.'
              : 'Open an event to upload your photos.'}
          </p>
        </div>
        {isAdmin && (
          <button className="btn-primary" onClick={() => setShowForm((s) => !s)}>
            {showForm ? 'Cancel' : 'New event'}
          </button>
        )}
      </div>

      <Alert>{error}</Alert>

      {showForm && (
        <form onSubmit={createEvent} className="card space-y-4">
          <div>
            <label className="label" htmlFor="ev-name">Event name</label>
            <input
              id="ev-name"
              className="input"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              required
              placeholder="e.g. Arjun & Priya Wedding"
            />
          </div>
          <div>
            <label className="label" htmlFor="ev-desc">Description (optional)</label>
            <textarea
              id="ev-desc"
              className="input"
              rows={2}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </div>
          <button className="btn-primary" disabled={creating}>
            {creating ? 'Creating…' : 'Create event'}
          </button>
        </form>
      )}

      {events.length === 0 ? (
        <EmptyState
          title="No events yet"
          hint={isAdmin ? 'Click “New event” to get started.' : 'Your lead hasn’t assigned you to an event yet.'}
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {events.map((ev) => (
            <li key={ev.id}>
              <Link to={`/events/${ev.id}`} className="card block transition hover:border-brand-300 hover:shadow">
                <div className="flex items-start justify-between">
                  <h2 className="font-medium text-slate-900">{ev.name}</h2>
                  {ev.gallery?.isPublished ? (
                    <Badge tone="green">Published</Badge>
                  ) : ev.gallery ? (
                    <Badge tone="amber">Draft gallery</Badge>
                  ) : (
                    <Badge>No gallery</Badge>
                  )}
                </div>
                {ev.description && (
                  <p className="mt-1 line-clamp-2 text-sm text-slate-500">{ev.description}</p>
                )}
                <div className="mt-3 flex gap-4 text-xs text-slate-400">
                  <span>{ev._count?.photos ?? 0} photos</span>
                  <span>{ev._count?.members ?? 0} team members</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
