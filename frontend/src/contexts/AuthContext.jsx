import React, { createContext, useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import api from '../api/client';

const AuthContext = createContext(null);

// Small helper to load initial auth state from localStorage.
function loadInitialAuth() {
  try {
    const stored = window.localStorage.getItem('etradie_auth');
    if (!stored) return { user: null, token: null };
    const parsed = JSON.parse(stored);
    const user = parsed?.user || null;
    const token = parsed?.token || null;
    // Prevent half-auth states (user without token, or token without user).
    if (!user || !token) return { user: null, token: null };
    return { user, token };
  } catch {
    return { user: null, token: null };
  }
}

export function AuthProvider({ children }) {
  const navigate = useNavigate();
  const [user, setUser] = useState(() => {
    if (typeof window === 'undefined') return null;
    const { user: initialUser } = loadInitialAuth();
    return initialUser;
  });
  const [token, setToken] = useState(() => {
    if (typeof window === 'undefined') return null;
    const { token: initialToken } = loadInitialAuth();
    return initialToken;
  });
  const [socket, setSocket] = useState(null);
  const [isSocketConnected, setIsSocketConnected] = useState(false);

  // Ensure Axios has the auth header when token is present.
  useEffect(() => {
    if (token) {
      api.defaults.headers.common.Authorization = `Bearer ${token}`;
    } else {
      delete api.defaults.headers.common.Authorization;
    }
  }, [token]);

  // Keep localStorage in sync whenever auth changes.
  useEffect(() => {
    if (user && token) {
      window.localStorage.setItem(
        'etradie_auth',
        JSON.stringify({ user, token })
      );
    } else {
      window.localStorage.removeItem('etradie_auth');
    }
  }, [user, token]);

  // Manage Socket.IO lifecycle: connect when logged in (for real-time jobs and messages).
  useEffect(() => {
    if (!token || !user) {
      if (socket) {
        socket.disconnect();
        setSocket(null);
      }
      setIsSocketConnected(false);
      return;
    }

    const SOCKET_URL =
      import.meta.env.VITE_SOCKET_URL ||
      import.meta.env.VITE_API_URL ||
      'http://localhost:4000';

    const newSocket = io(SOCKET_URL, {
      auth: {
        token,
      },
    });

    setIsSocketConnected(newSocket.connected);
    newSocket.on('connect', () => setIsSocketConnected(true));
    newSocket.on('disconnect', () => setIsSocketConnected(false));

    setSocket(newSocket);

    return () => {
      newSocket.off('connect');
      newSocket.off('disconnect');
      newSocket.disconnect();
    };
  }, [token, user?.role]);

  async function register(payload) {
    const response = await api.post('/auth/register', payload);
    const { token: newToken, user: newUser } = response.data;

    setUser(newUser);
    setToken(newToken);
    api.defaults.headers.common.Authorization = `Bearer ${newToken}`;

    if (newUser.role === 'HOMEOWNER') {
      navigate('/dashboard');
    } else if (newUser.role === 'TRADESPERSON') {
      navigate('/tradesperson-dashboard');
    }
  }

  async function login(credentials) {
    const response = await api.post('/auth/login', credentials);
    const { token: newToken, user: newUser } = response.data;

    setUser(newUser);
    setToken(newToken);
    api.defaults.headers.common.Authorization = `Bearer ${newToken}`;

    if (newUser.role === 'HOMEOWNER') {
      navigate('/dashboard');
    } else if (newUser.role === 'TRADESPERSON') {
      navigate('/tradesperson-dashboard');
    }
  }

  function logout() {
    setUser(null);
    setToken(null);
    delete api.defaults.headers.common.Authorization;
    navigate('/login');
  }

  const value = {
    user,
    token,
    socket,
    isSocketConnected,
    register,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}

