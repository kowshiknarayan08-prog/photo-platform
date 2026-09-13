import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { Badge } from './ui.jsx';

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-full">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link to="/" className="flex items-center gap-2 font-semibold text-slate-900">
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-brand-600 text-white">P</span>
            PhotoShare
          </Link>

          <nav className="flex items-center gap-3 text-sm">
            {user ? (
              <>
                <NavLink
                  to="/"
                  end
                  className={({ isActive }) =>
                    isActive ? 'font-medium text-brand-700' : 'text-slate-600 hover:text-slate-900'
                  }
                >
                  Events
                </NavLink>
                <span className="hidden items-center gap-2 sm:flex">
                  <span className="text-slate-500">{user.name}</span>
                  <Badge tone={user.role === 'ADMIN' ? 'indigo' : 'slate'}>{user.role}</Badge>
                </span>
                <button
                  className="btn-secondary"
                  onClick={() => {
                    logout();
                    navigate('/login');
                  }}
                >
                  Sign out
                </button>
              </>
            ) : (
              <>
                <NavLink to="/login" className="text-slate-600 hover:text-slate-900">
                  Sign in
                </NavLink>
                <NavLink to="/register" className="btn-primary">
                  Create account
                </NavLink>
              </>
            )}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
