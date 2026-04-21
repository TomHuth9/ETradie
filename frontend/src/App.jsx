import React, { useState, useRef, useEffect } from 'react';
import { Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import Register from './pages/Register';
import Login from './pages/Login';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import HomeownerDashboard from './pages/HomeownerDashboard';
import TradespersonDashboard from './pages/TradespersonDashboard';
import JobDetail from './pages/JobDetail';
import Profile from './pages/Profile';
import TradespersonProfile from './pages/TradespersonProfile';
import Footer from './components/Footer';
import { useAuth } from './contexts/AuthContext';
import { useNotifications } from './contexts/NotificationsContext';

function ProtectedRoute({ children, allowedRoles }) {
  const { user, token } = useAuth();
  if (!user || !token) return <Navigate to="/login" replace />;
  if (allowedRoles && !allowedRoles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
}

function NotificationsDropdown({ notifications, unreadCount, markAsRead, markAllRead }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="nav-link"
        style={{ display: 'flex', alignItems: 'center', gap: 6, background: open ? 'var(--color-surface)' : undefined, border: 'none', cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: '0.875rem' }}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M8 1a5 5 0 0 1 5 5v3l1.5 2H1.5L3 9V6a5 5 0 0 1 5-5zm0 14a2 2 0 0 1-2-2h4a2 2 0 0 1-2 2z" fill="currentColor"/>
        </svg>
        {unreadCount > 0 && <span className="notif-badge">{unreadCount}</span>}
      </button>

      {open && (
        <div className="card" style={{ position: 'absolute', right: 0, top: 'calc(100% + 8px)', minWidth: 288, maxWidth: 340, zIndex: 200, padding: 0, overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px 10px', borderBottom: '1px solid var(--color-border)' }}>
            <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: '0.9375rem' }}>Notifications</span>
            {unreadCount > 0 && (
              <button type="button" onClick={markAllRead} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.75rem', color: 'var(--color-primary)', fontWeight: 500, fontFamily: 'var(--font-body)', padding: 0 }}>
                Mark all read
              </button>
            )}
          </div>
          {notifications.length === 0 ? (
            <p style={{ padding: '20px 16px', margin: 0, fontSize: '0.875rem', color: 'var(--color-text-muted)', textAlign: 'center' }}>No notifications yet.</p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, maxHeight: 280, overflowY: 'auto' }}>
              {notifications.map(n => (
                <li key={n.id}
                  style={{ padding: '10px 16px', borderBottom: '1px solid var(--color-surface)', opacity: n.readAt ? 0.65 : 1, cursor: n.link ? 'pointer' : 'default', display: 'flex', gap: 10, alignItems: 'flex-start' }}
                  onClick={() => { if (!n.readAt) markAsRead(n.id); }}
                >
                  {!n.readAt && <span className="notif-dot" />}
                  {n.readAt && <span style={{ width: 7, flexShrink: 0 }} />}
                  {n.link
                    ? <Link to={n.link} className="card-meta" style={{ fontSize: '0.84375rem', color: 'var(--color-text)', textDecoration: 'none', lineHeight: 1.4 }}>{n.message}</Link>
                    : <span style={{ fontSize: '0.84375rem', color: 'var(--color-text)', lineHeight: 1.4 }}>{n.message}</span>
                  }
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function Layout({ children }) {
  const { user, logout } = useAuth();
  const { unreadCount, notifications, markAsRead, markAllRead } = useNotifications();
  const location = useLocation();

  return (
    <div>
      <header className="header">
        <div className="header-inner">
          <Link to="/" className="logo">
            <span className="logo-icon">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path d="M9 2L2 8h2v8h4v-5h2v5h4V8h2L9 2z" fill="white"/>
              </svg>
            </span>
            etradie
          </Link>

          <nav className="nav">
            {!user && (
              <>
                <Link to="/login" className={`nav-link${location.pathname === '/login' ? ' active' : ''}`}>Log in</Link>
                <Link to="/register" className="btn btn-cta btn-sm">Get started</Link>
              </>
            )}
            {user && (
              <>
                {user.role === 'HOMEOWNER' && (
                  <Link to="/dashboard" className={`nav-link${location.pathname === '/dashboard' ? ' active' : ''}`}>Dashboard</Link>
                )}
                {user.role === 'TRADESPERSON' && (
                  <Link to="/tradesperson-dashboard" className={`nav-link${location.pathname === '/tradesperson-dashboard' ? ' active' : ''}`}>Jobs</Link>
                )}
                <NotificationsDropdown
                  notifications={notifications}
                  unreadCount={unreadCount}
                  markAsRead={markAsRead}
                  markAllRead={markAllRead}
                />
                <Link to="/profile" className={`nav-link${location.pathname === '/profile' ? ' active' : ''}`}>Profile</Link>
                <button type="button" className="btn btn-ghost btn-sm" onClick={logout}>Log out</button>
              </>
            )}
          </nav>
        </div>
      </header>

      <div className="container">
        <main>{children}</main>
        <Footer />
      </div>
    </div>
  );
}

export default function App() {
  const { user } = useAuth();

  return (
    <Layout>
      <Routes>
        <Route path="/" element={
          user ? (
            user.role === 'HOMEOWNER'
              ? <Navigate to="/dashboard" replace />
              : <Navigate to="/tradesperson-dashboard" replace />
          ) : (
            <div className="hero">
              <div>
                <div className="hero-pill">
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--color-primary)', display: 'inline-block' }} />
                  Live in your area
                </div>
                <h1 style={{ fontSize: '2.75rem', lineHeight: 1.15, marginBottom: 18, letterSpacing: '-0.5px' }}>
                  Find a trusted tradesperson<span style={{ color: 'var(--color-cta)' }}>in minutes.</span>
                </h1>
                <p className="page-subtitle" style={{ fontSize: '1.0625rem', maxWidth: '38ch', marginBottom: 32 }}>
                  Post your job, get matched with local tradespeople nearby, and get it done.
                </p>
                <div className="cta-group">
                  <Link to="/register" className="btn btn-cta btn-lg">Post a job - it's free</Link>
                  <Link to="/login" className="btn btn-ghost btn-lg">Log in</Link>
                </div>
              </div>
              <div className="hero-illustration">
                <span style={{ fontSize: '3rem' }}>🏠</span>
                <span style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--color-text-muted)', textAlign: 'center', padding: '0 24px' }}>hero illustration</span>
              </div>
            </div>
          )
        } />
        <Route path="/register" element={<Register />} />
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
        <Route path="/profile/:id" element={<ProtectedRoute><TradespersonProfile /></ProtectedRoute>} />
        <Route path="/jobs/:id" element={<ProtectedRoute><JobDetail /></ProtectedRoute>} />
        <Route path="/dashboard" element={<ProtectedRoute allowedRoles={['HOMEOWNER']}><HomeownerDashboard /></ProtectedRoute>} />
        <Route path="/tradesperson-dashboard" element={<ProtectedRoute allowedRoles={['TRADESPERSON']}><TradespersonDashboard /></ProtectedRoute>} />
      </Routes>
    </Layout>
  );
}
