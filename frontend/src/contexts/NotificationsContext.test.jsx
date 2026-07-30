import React from 'react';
import { renderHook, waitFor, act } from '@testing-library/react';
import { vi } from 'vitest';

const mockGet = vi.fn();
const mockPost = vi.fn();
vi.mock('../api/client', () => ({
  default: {
    get: (...args) => mockGet(...args),
    post: (...args) => mockPost(...args),
  },
}));

let mockAuth = { user: null, socket: null };
vi.mock('./AuthContext', () => ({
  useAuth: () => mockAuth,
}));

import { NotificationsProvider, useNotifications } from './NotificationsContext';

const sampleNotifications = [
  { id: 1, type: 'message', message: 'New message on "Fix tap"', readAt: null, createdAt: '2026-01-01T00:00:00Z' },
  { id: 2, type: 'job_accepted', message: 'Your job was accepted', readAt: '2026-01-01T01:00:00Z', createdAt: '2026-01-01T00:00:00Z' },
];

function renderNotifications() {
  return renderHook(() => useNotifications(), {
    wrapper: ({ children }) => <NotificationsProvider>{children}</NotificationsProvider>,
  });
}

describe('NotificationsContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth = { user: null, socket: null };
  });

  test('does not fetch notifications when there is no logged-in user', async () => {
    const { result } = renderNotifications();
    expect(result.current.notifications).toEqual([]);
    expect(mockGet).not.toHaveBeenCalled();
  });

  test('loads notifications for the current user on mount', async () => {
    mockAuth = { user: { id: 1 }, socket: null };
    mockGet.mockResolvedValue({ data: sampleNotifications });

    const { result } = renderNotifications();

    await waitFor(() => expect(result.current.notifications).toHaveLength(2));
    expect(mockGet).toHaveBeenCalledWith('/notifications');
  });

  test('unreadCount reflects notifications without a readAt', async () => {
    mockAuth = { user: { id: 1 }, socket: null };
    mockGet.mockResolvedValue({ data: sampleNotifications });

    const { result } = renderNotifications();

    await waitFor(() => expect(result.current.unreadCount).toBe(1));
  });

  test('markAsRead posts to the API and marks that notification read locally', async () => {
    mockAuth = { user: { id: 1 }, socket: null };
    mockGet.mockResolvedValue({ data: sampleNotifications });
    mockPost.mockResolvedValue({ data: {} });

    const { result } = renderNotifications();
    await waitFor(() => expect(result.current.notifications).toHaveLength(2));

    await act(async () => {
      await result.current.markAsRead(1);
    });

    expect(mockPost).toHaveBeenCalledWith('/notifications/1/read');
    expect(result.current.notifications.find((n) => n.id === 1).readAt).not.toBeNull();
    expect(result.current.unreadCount).toBe(0);
  });

  test('markAllRead posts to the API and marks every notification read locally', async () => {
    mockAuth = { user: { id: 1 }, socket: null };
    mockGet.mockResolvedValue({ data: sampleNotifications });
    mockPost.mockResolvedValue({ data: {} });

    const { result } = renderNotifications();
    await waitFor(() => expect(result.current.notifications).toHaveLength(2));

    await act(async () => {
      await result.current.markAllRead();
    });

    expect(mockPost).toHaveBeenCalledWith('/notifications/read-all');
    expect(result.current.unreadCount).toBe(0);
  });

  test('a live "notification:new" socket event prepends the new notification', async () => {
    const handlers = {};
    const mockSocket = {
      on: vi.fn((event, cb) => { handlers[event] = cb; }),
      off: vi.fn(),
    };
    mockAuth = { user: { id: 1 }, socket: mockSocket };
    mockGet.mockResolvedValue({ data: [] });

    const { result } = renderNotifications();
    await waitFor(() => expect(mockSocket.on).toHaveBeenCalledWith('notification:new', expect.any(Function)));

    const incoming = { id: 99, type: 'message', message: 'Brand new', readAt: null, createdAt: '2026-01-02T00:00:00Z' };
    act(() => {
      handlers['notification:new'](incoming);
    });

    expect(result.current.notifications[0]).toEqual(incoming);
  });
});
