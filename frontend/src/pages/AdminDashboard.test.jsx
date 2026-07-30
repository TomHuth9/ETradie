import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';

const mockGet = vi.fn();
const mockDelete = vi.fn();
vi.mock('../api/client', () => ({
  default: {
    get: (...args) => mockGet(...args),
    delete: (...args) => mockDelete(...args),
  },
}));

let mockCurrentUser = { id: 1, role: 'ADMIN' };
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ user: mockCurrentUser }),
}));

const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();
vi.mock('react-hot-toast', () => ({
  default: { success: (...args) => mockToastSuccess(...args), error: (...args) => mockToastError(...args) },
}));

import AdminDashboard from './AdminDashboard';

function parseParams(url) {
  return Object.fromEntries(new URLSearchParams(url.split('?')[1] || ''));
}

const sampleJob = {
  id: 1, title: 'Fix leaking radiator', category: 'PLUMBING', status: 'PENDING',
  homeowner: { name: 'Grace Homeowner', email: 'grace@example.com' }, createdAt: '2026-01-01T00:00:00Z',
};

const sampleUser = {
  id: 2, name: 'Tom Tradesperson', email: 'tom@example.com', role: 'TRADESPERSON',
  townOrCity: 'Glasgow', isOnline: true, createdAt: '2026-01-01T00:00:00Z',
};

function mockJobs(jobs, total = jobs.length) {
  mockGet.mockImplementation((url) => {
    if (url.startsWith('/admin/jobs')) return Promise.resolve({ data: { jobs, total, page: 1, limit: 20 } });
    return Promise.reject(new Error(`Unexpected URL: ${url}`));
  });
}

function mockUsers(users, total = users.length) {
  mockGet.mockImplementation((url) => {
    if (url.startsWith('/admin/users')) return Promise.resolve({ data: { users, total, page: 1, limit: 20 } });
    return Promise.reject(new Error(`Unexpected URL: ${url}`));
  });
}

describe('AdminDashboard page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCurrentUser = { id: 1, role: 'ADMIN' };
  });

  describe('tabs', () => {
    test('shows the Jobs tab by default and loads jobs', async () => {
      mockJobs([sampleJob]);
      render(<AdminDashboard />);

      await waitFor(() => expect(screen.getByText('Fix leaking radiator')).toBeInTheDocument());
      expect(mockGet).toHaveBeenCalledWith(expect.stringContaining('/admin/jobs'));
    });

    test('switching to the Users tab loads users instead', async () => {
      mockJobs([sampleJob]);
      render(<AdminDashboard />);
      await waitFor(() => expect(screen.getByText('Fix leaking radiator')).toBeInTheDocument());

      mockUsers([sampleUser]);
      fireEvent.click(screen.getByRole('button', { name: /^users$/i }));

      await waitFor(() => expect(screen.getByText('Tom Tradesperson')).toBeInTheDocument());
    });
  });

  describe('Jobs tab', () => {
    test('shows an empty state when there are no jobs', async () => {
      mockJobs([]);
      render(<AdminDashboard />);
      await waitFor(() => {
        expect(screen.getByText(/no jobs/i)).toBeInTheDocument();
      });
    });

    test('shows an error message when loading jobs fails', async () => {
      mockGet.mockRejectedValue({ response: { data: { message: 'Server error' } } });
      render(<AdminDashboard />);
      await waitFor(() => {
        expect(screen.getByText(/server error/i)).toBeInTheDocument();
      });
    });

    test('filtering by status re-fetches with the status query param', async () => {
      mockJobs([sampleJob]);
      render(<AdminDashboard />);
      await waitFor(() => expect(screen.getByText('Fix leaking radiator')).toBeInTheDocument());

      mockGet.mockClear();
      mockJobs([]);
      const [statusSelect] = screen.getAllByRole('combobox');
      fireEvent.change(statusSelect, { target: { value: 'COMPLETED' } });

      await waitFor(() => {
        const call = mockGet.mock.calls.find(([url]) => url.startsWith('/admin/jobs'));
        expect(call).toBeTruthy();
        expect(parseParams(call[0]).status).toBe('COMPLETED');
      });
    });

    test('shows pagination controls and requests the next page', async () => {
      mockJobs([sampleJob], 45); // 45 total / 20 per page = 3 pages
      render(<AdminDashboard />);
      await waitFor(() => expect(screen.getByText(/page 1 of 3/i)).toBeInTheDocument());

      mockGet.mockClear();
      fireEvent.click(screen.getByRole('button', { name: /next/i }));

      await waitFor(() => {
        const call = mockGet.mock.calls.find(([url]) => url.startsWith('/admin/jobs'));
        expect(call).toBeTruthy();
        expect(parseParams(call[0]).page).toBe('2');
      });
    });
  });

  describe('Users tab', () => {
    async function openUsersTab(users = [sampleUser], total) {
      mockJobs([]);
      render(<AdminDashboard />);
      await waitFor(() => expect(screen.getByText(/no jobs/i)).toBeInTheDocument());
      mockUsers(users, total);
      fireEvent.click(screen.getByRole('button', { name: /^users$/i }));
      // Always wait for the tab's fetch to settle, whether or not it has
      // results, so callers never observe an in-flight state update.
      await waitFor(() => {
        if (users.length > 0) {
          expect(screen.getByText(users[0].name)).toBeInTheDocument();
        } else {
          expect(screen.getByText(/no users/i)).toBeInTheDocument();
        }
      });
    }

    test('shows an empty state when there are no users', async () => {
      await openUsersTab([]);
      expect(screen.getByText(/no users/i)).toBeInTheDocument();
    });

    test('filtering by role re-fetches with the role query param', async () => {
      await openUsersTab();

      mockGet.mockClear();
      mockUsers([]);
      const [roleSelect] = screen.getAllByRole('combobox');
      fireEvent.change(roleSelect, { target: { value: 'HOMEOWNER' } });

      await waitFor(() => {
        const call = mockGet.mock.calls.find(([url]) => url.startsWith('/admin/users'));
        expect(call).toBeTruthy();
        expect(parseParams(call[0]).role).toBe('HOMEOWNER');
      });
    });

    test('does not show a delete button for the current admin\'s own row', async () => {
      mockCurrentUser = { id: 2, role: 'ADMIN' }; // matches sampleUser.id
      await openUsersTab();
      expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument();
    });

    test('shows a delete button for other users', async () => {
      await openUsersTab(); // currentUser.id = 1, sampleUser.id = 2
      expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument();
    });

    test('deleting a user asks for confirmation and does nothing if declined', async () => {
      await openUsersTab();
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);

      fireEvent.click(screen.getByRole('button', { name: /delete/i }));

      expect(confirmSpy).toHaveBeenCalledWith('Delete Tom Tradesperson (tom@example.com)? This cannot be undone.');
      expect(mockDelete).not.toHaveBeenCalled();
      expect(screen.getByText('Tom Tradesperson')).toBeInTheDocument();

      confirmSpy.mockRestore();
    });

    test('confirming delete removes the user from the list and shows a success toast', async () => {
      await openUsersTab();
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      mockDelete.mockResolvedValue({ data: { message: 'User deleted' } });

      fireEvent.click(screen.getByRole('button', { name: /delete/i }));

      await waitFor(() => expect(mockDelete).toHaveBeenCalledWith('/admin/users/2'));
      await waitFor(() => {
        expect(screen.queryByText('Tom Tradesperson')).not.toBeInTheDocument();
      });
      expect(mockToastSuccess).toHaveBeenCalledWith('Tom Tradesperson deleted');

      window.confirm.mockRestore();
    });

    test('shows an error toast if deletion fails', async () => {
      await openUsersTab();
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      mockDelete.mockRejectedValue({ response: { data: { message: 'Cannot delete your own account' } } });

      fireEvent.click(screen.getByRole('button', { name: /delete/i }));

      await waitFor(() => expect(mockToastError).toHaveBeenCalledWith('Cannot delete your own account'));
      expect(screen.getByText('Tom Tradesperson')).toBeInTheDocument();

      window.confirm.mockRestore();
    });
  });
});
