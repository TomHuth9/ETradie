import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { vi } from 'vitest';

const mockGet = vi.fn();
const mockPost = vi.fn();
vi.mock('../api/client', () => ({
  default: {
    get: (...args) => mockGet(...args),
    post: (...args) => mockPost(...args),
  },
}));

let mockAuth = { user: { id: 1, name: 'Tom Tradesperson' }, socket: null, isSocketConnected: false };
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => mockAuth,
}));

import TradespersonDashboard from './TradespersonDashboard';

const categories = [{ id: 'PLUMBING', label: 'Plumbing' }, { id: 'ELECTRICAL', label: 'Electrical' }];
const nearbyJob = {
  id: 10, title: 'Fix leaking tap', category: 'PLUMBING', locationText: '10 High Street, Glasgow',
  createdAt: '2026-01-01T00:00:00Z',
};

function mockApi({ nearby = [], history = [] } = {}) {
  mockGet.mockImplementation((url) => {
    if (url === '/trades/categories') return Promise.resolve({ data: categories });
    if (url === '/jobs/my') return Promise.resolve({ data: { jobs: history } });
    if (url === '/jobs/nearby') return Promise.resolve({ data: nearby });
    return Promise.reject(new Error(`Unexpected URL: ${url}`));
  });
}

describe('TradespersonDashboard page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth = { user: { id: 1, name: 'Tom Tradesperson' }, socket: null, isSocketConnected: false };
  });

  test('greets the user by first name', async () => {
    mockApi();
    render(<MemoryRouter><TradespersonDashboard /></MemoryRouter>);
    expect(screen.getByText(/good to see you, tom/i)).toBeInTheDocument();
  });

  test('shows "Connecting…" when there is no socket yet', () => {
    mockApi();
    mockAuth = { ...mockAuth, socket: null, isSocketConnected: false };
    render(<MemoryRouter><TradespersonDashboard /></MemoryRouter>);
    expect(screen.getByText(/connecting/i)).toBeInTheDocument();
  });

  test('shows the live connection label when the socket is connected', () => {
    mockApi();
    mockAuth = { ...mockAuth, socket: { on: vi.fn(), off: vi.fn() }, isSocketConnected: true };
    render(<MemoryRouter><TradespersonDashboard /></MemoryRouter>);
    expect(screen.getByText(/live - receiving job requests/i)).toBeInTheDocument();
  });

  test('loads and displays nearby jobs, requesting the default 25km radius', async () => {
    mockApi({ nearby: [nearbyJob] });
    render(<MemoryRouter><TradespersonDashboard /></MemoryRouter>);

    await waitFor(() => {
      expect(screen.getByText('Fix leaking tap')).toBeInTheDocument();
    });
    expect(mockGet).toHaveBeenCalledWith('/jobs/nearby', { params: { radiusKm: 25 } });
  });

  test('shows an empty state when there are no nearby jobs', async () => {
    mockApi({ nearby: [] });
    render(<MemoryRouter><TradespersonDashboard /></MemoryRouter>);

    await waitFor(() => {
      expect(screen.getByText(/waiting for nearby jobs/i)).toBeInTheDocument();
    });
  });

  test('dragging the radius slider re-fetches nearby jobs with the new radius', async () => {
    mockApi({ nearby: [nearbyJob] });
    render(<MemoryRouter><TradespersonDashboard /></MemoryRouter>);

    await waitFor(() => expect(screen.getByText('Fix leaking tap')).toBeInTheDocument());
    mockGet.mockClear();

    fireEvent.change(screen.getByLabelText(/radius/i), { target: { value: '50' } });
    expect(screen.getByText(/radius: 50 km/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledWith('/jobs/nearby', { params: { radiusKm: 50 } });
    }, { timeout: 2000 });
  });

  test('links each job card to its detail page for quoting instead of one-click accept', async () => {
    mockApi({ nearby: [nearbyJob] });
    render(<MemoryRouter><TradespersonDashboard /></MemoryRouter>);

    await waitFor(() => expect(screen.getByText('Fix leaking tap')).toBeInTheDocument());
    expect(screen.getByRole('link', { name: /view & quote/i })).toHaveAttribute('href', '/jobs/10');
    expect(screen.queryByRole('button', { name: /^accept$/i })).not.toBeInTheDocument();
  });

  test('declining a job posts the decline and removes it from the nearby list', async () => {
    mockApi({ nearby: [nearbyJob] });
    mockPost.mockResolvedValue({ data: {} });
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<MemoryRouter><TradespersonDashboard /></MemoryRouter>);

    await waitFor(() => expect(screen.getByText('Fix leaking tap')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /decline/i }));

    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/jobs/10/decline'));
    await waitFor(() => {
      expect(screen.queryByText('Fix leaking tap')).not.toBeInTheDocument();
    });
    confirmSpy.mockRestore();
  });

  test('shows an error message when declining a job fails', async () => {
    mockApi({ nearby: [nearbyJob] });
    mockPost.mockRejectedValue({ response: { data: { message: 'Job is no longer available' } } });
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<MemoryRouter><TradespersonDashboard /></MemoryRouter>);

    await waitFor(() => expect(screen.getByText('Fix leaking tap')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /decline/i }));

    await waitFor(() => {
      expect(screen.getByText(/job is no longer available/i)).toBeInTheDocument();
    });
    confirmSpy.mockRestore();
  });

  test('displays recent job history', async () => {
    mockApi({ history: [{ id: 20, title: 'Rewire kitchen', locationText: 'Glasgow', status: 'COMPLETED', createdAt: '2026-01-01T00:00:00Z' }] });
    render(<MemoryRouter><TradespersonDashboard /></MemoryRouter>);

    await waitFor(() => {
      expect(screen.getByText('Rewire kitchen')).toBeInTheDocument();
    });
  });

  test('a new job broadcast via socket is added to the nearby list', async () => {
    const handlers = {};
    const mockSocket = {
      on: vi.fn((event, cb) => { handlers[event] = cb; }),
      off: vi.fn(),
    };
    mockAuth = { ...mockAuth, socket: mockSocket, isSocketConnected: true };
    mockApi({ nearby: [] });
    render(<MemoryRouter><TradespersonDashboard /></MemoryRouter>);

    await waitFor(() => expect(mockSocket.on).toHaveBeenCalledWith('job:new', expect.any(Function)));
    await waitFor(() => expect(screen.getByText(/waiting for nearby jobs/i)).toBeInTheDocument());

    const newJob = { id: 30, title: 'Unblock drain', category: 'PLUMBING', locationText: 'Glasgow', createdAt: '2026-01-02T00:00:00Z' };
    act(() => {
      handlers['job:new'](newJob);
    });

    await waitFor(() => {
      expect(screen.getByText('Unblock drain')).toBeInTheDocument();
    });
  });
});
