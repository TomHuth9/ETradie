import React, { createContext, useContext, useEffect, useState } from 'react';
import api from '../api/client';
import { useAuth } from './AuthContext';

const NotificationsContext = createContext(null);

export function NotificationsProvider({ children }) {
  const { user, socket } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);

  // Load notifications when user logs in.
  useEffect(() => {
    if (!user) {
      setNotifications([]);
      return;
    }
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const res = await api.get('/notifications');
        if (!cancelled && Array.isArray(res.data)) {
          setNotifications(res.data);
        }
      } catch {
        // ignore, UI will just show none
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [user?.id]);

  // Live notifications via Socket.IO
  useEffect(() => {
    if (!socket) return;
    function handler(notification) {
      setNotifications((prev) => [notification, ...(Array.isArray(prev) ? prev : [])]);
    }
    socket.on('notification:new', handler);
    return () => {
      socket.off('notification:new', handler);
    };
  }, [socket]);

  const unreadCount = notifications.filter((n) => !n.readAt).length;

  async function markAsRead(id) {
    try {
      await api.post(`/notifications/${id}/read`);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, readAt: n.readAt || new Date().toISOString() } : n))
      );
    } catch {
      // ignore
    }
  }

  async function markAllRead() {
    try {
      await api.post('/notifications/read-all');
      setNotifications((prev) =>
        prev.map((n) => (n.readAt ? n : { ...n, readAt: new Date().toISOString() }))
      );
    } catch {
      // ignore
    }
  }

  const value = {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllRead,
  };

  return (
    <NotificationsContext.Provider value={value}>
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error('useNotifications must be used within NotificationsProvider');
  return ctx;
}

