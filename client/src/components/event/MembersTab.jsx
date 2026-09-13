import { useEffect, useState } from 'react';
import { api } from '../../lib/api.js';
import { Alert, EmptyState, PageLoader } from '../ui.jsx';

export default function MembersTab({ eventId, isAdmin, onChanged }) {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  async function load() {
    setLoading(true);
    try {
      const data = await api.get(`/events/${eventId}/members`);
      setMembers(data.members);
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

  async function add(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await api.post(`/events/${eventId}/members`, form);
      setNotice(`Added ${form.email}. Share the password with them to sign in.`);
      setForm({ name: '', email: '', password: '' });
      await load();
      onChanged?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(userId) {
    if (!confirm('Remove this member from the event?')) return;
    try {
      await api.del(`/events/${eventId}/members/${userId}`);
      await load();
      onChanged?.();
    } catch (err) {
      setError(err.message);
    }
  }

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-5">
      <Alert>{error}</Alert>
      {notice && <Alert kind="success">{notice}</Alert>}

      {isAdmin && (
        <form onSubmit={add} className="card grid gap-3 sm:grid-cols-4 sm:items-end">
          <div className="sm:col-span-1">
            <label className="label">Name</label>
            <input
              className="input"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              required
            />
          </div>
          <div className="sm:col-span-1">
            <label className="label">Email</label>
            <input
              type="email"
              className="input"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              required
            />
          </div>
          <div className="sm:col-span-1">
            <label className="label">Temp password</label>
            <input
              className="input"
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              required
              minLength={8}
            />
          </div>
          <button className="btn-primary sm:col-span-1" disabled={busy}>
            {busy ? 'Adding…' : 'Add member'}
          </button>
        </form>
      )}

      {members.length === 0 ? (
        <EmptyState title="No team members yet" />
      ) : (
        <ul className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
          {members.map((m) => (
            <li key={m.id} className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="text-sm font-medium text-slate-800">{m.name}</p>
                <p className="text-xs text-slate-500">{m.email}</p>
              </div>
              {isAdmin && (
                <button className="btn-secondary" onClick={() => remove(m.id)}>
                  Remove
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
