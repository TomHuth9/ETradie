import React from 'react';
import { Routes, Route, Navigate, Link } from 'react-router-dom';
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

  if (!user || !token) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    // If role not allowed, send to a simple landing page.
    return <Navigate to="/" replace />;
  }

  return children;
}

function Layout({ children }) {
  const { user, logout } = useAuth();
  const { unreadCount, notifications, markAsRead, markAllRead } = useNotifications();
  const hasUnread = unreadCount > 0;

  return (
    <div className="container">
      <header className="header">
        <Link to="/" className="logo">
          ETradie
        </Link>
        <nav className="nav">
          {!user && (
            <>
              <Link to="/login" className="nav-link">Login</Link>
              <Link to="/register" className="nav-link">Register</Link>
            </>
          )}
          {user && (
            <>
              {user.role === 'HOMEOWNER' && (
                <Link to="/dashboard" className="nav-link">Dashboard</Link>
              )}
              {user.role === 'TRADESPERSON' && (
                <Link to="/tradesperson-dashboard" className="nav-link">Jobs</Link>
              )}
              <div className="nav-link" style={{ position: 'relative' }}>
                <details>
                  <summary style={{ listStyle: 'none', cursor: 'pointer' }}>
                    Notifications{hasUnread ? ` (${unreadCount})` : ''}
                  </summary>
                  <div className="card" style={{ position: 'absolute', right: 0, marginTop: '0.5rem', zIndex: 20, minWidth: '260px', maxWidth: '320px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <span style={{ fontWeight: 600, fontSize: '0.9375rem' }}>Notifications</span>
                      {hasUnread && (
                        <button
                          type="button"
                          className="btn btn-ghost"
                          style={{ fontSize: '0.75rem', padding: 0 }}
                          onClick={markAllRead}
                        >
                          Mark all read
                        </button>
                      )}
                    </div>
                    {notifications.length === 0 ? (
                      <p className="card-meta">No notifications yet.</p>
                    ) : (
                      <ul style={{ listStyle: 'none', padding: 0, margin: 0, maxHeight: '260px', overflowY: 'auto' }}>
                        {notifications.map((n) => (
                          <li
                            key={n.id}
                            style={{
                              padding: '0.5rem 0',
                              borderBottom: '1px solid var(--color-border)',
                              opacity: n.readAt ? 0.7 : 1,
                              cursor: n.link ? 'pointer' : 'default',
                            }}
                            onClick={() => {
                              if (!n.readAt) markAsRead(n.id);
                            }}
                          >
                            {n.link ? (
                              <Link to={n.link} className="card-meta-link">
                                {n.message}
                              </Link>
                            ) : (
                              <span style={{ fontSize: '0.875rem' }}>{n.message}</span>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </details>
              </div>
              <Link to="/profile" className="nav-link">Profile</Link>
              <button type="button" className="btn btn-secondary" onClick={logout}>
                Logout
              </button>
            </>
          )}
        </nav>
      </header>
      <main>{children}</main>
      <Footer />
    </div>
  );
}

export default function App() {
  const { user } = useAuth();

  return (
    <Layout>
      <Routes>
        <Route
          path="/"
          element={
            user ? (
              user.role === 'HOMEOWNER' ? (
                <Navigate to="/dashboard" replace />
              ) : (
                <Navigate to="/tradesperson-dashboard" replace />
              )
            ) : (
              <div className="page-header">
                <h1>Welcome to ETradie</h1>
                <p className="page-subtitle" style={{ fontSize: '1.125rem', maxWidth: '32ch' }}>
                  Connect homeowners with trusted local tradespeople in real time.
                </p>
                <div className="cta-group">
                  <Link to="/register" className="btn btn-primary">Get started</Link>
                  <Link to="/login" className="btn btn-secondary">Log in</Link>
                </div>
              </div>
            )
          }
        />
        <Route path="/register" element={<Register />} />
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
        <Route path="/profile/:id" element={<ProtectedRoute><TradespersonProfile /></ProtectedRoute>} />
        <Route
          path="/jobs/:id"
          element={
            <ProtectedRoute>
              <JobDetail />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute allowedRoles={['HOMEOWNER']}>
              <HomeownerDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/tradesperson-dashboard"
          element={
            <ProtectedRoute allowedRoles={['TRADESPERSON']}>
              <TradespersonDashboard />
            </ProtectedRoute>
          }
        />
      </Routes>
    </Layout>
  );
}

