import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';

const mockPost = vi.fn();
vi.mock('../api/client', () => ({
  default: { post: (...args) => mockPost(...args) },
}));

const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();
vi.mock('react-hot-toast', () => ({
  default: { success: (...args) => mockToastSuccess(...args), error: (...args) => mockToastError(...args) },
}));

import ResetPassword from './ResetPassword';

function renderWithToken(token = 'abc123') {
  const entry = token ? `/reset-password?token=${token}` : '/reset-password';
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <ResetPassword />
    </MemoryRouter>
  );
}

describe('ResetPassword page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders the password fields', () => {
    renderWithToken();
    expect(screen.getByLabelText(/new password/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();
  });

  test('disables the submit button when there is no token in the URL', () => {
    renderWithToken(null);
    expect(screen.getByRole('button', { name: /reset password/i })).toBeDisabled();
  });

  test('shows a validation error for a password missing required character classes', async () => {
    renderWithToken();
    fireEvent.change(screen.getByLabelText(/new password/i), { target: { value: 'alllowercase' } });
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'alllowercase' } });
    fireEvent.click(screen.getByRole('button', { name: /reset password/i }));

    // The live password-strength hint also mentions "uppercase" as part of a
    // longer message, so match the field-error's exact (shorter) text only.
    await waitFor(() => {
      expect(screen.getByText(/^include at least one uppercase letter$/i)).toBeInTheDocument();
    });
    expect(mockPost).not.toHaveBeenCalled();
  });

  test('shows an error when the passwords do not match', async () => {
    renderWithToken();
    fireEvent.change(screen.getByLabelText(/new password/i), { target: { value: 'Password123' } });
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'Password456' } });
    fireEvent.click(screen.getByRole('button', { name: /reset password/i }));

    await waitFor(() => {
      expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument();
    });
    expect(mockPost).not.toHaveBeenCalled();
  });

  test('submits the token and new password, then shows the confirmation screen', async () => {
    mockPost.mockResolvedValue({ data: {} });
    renderWithToken('abc123');

    fireEvent.change(screen.getByLabelText(/new password/i), { target: { value: 'Password123' } });
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'Password123' } });
    fireEvent.click(screen.getByRole('button', { name: /reset password/i }));

    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/auth/reset-password', {
      token: 'abc123',
      newPassword: 'Password123',
    }));
    await waitFor(() => {
      expect(screen.getByText(/your password has been updated/i)).toBeInTheDocument();
    });
    expect(mockToastSuccess).toHaveBeenCalled();
  });

  test('shows an error toast when the reset request fails (e.g. expired token)', async () => {
    mockPost.mockRejectedValue({ response: { data: { message: 'Invalid or expired reset token' } } });
    renderWithToken('expired-token');

    fireEvent.change(screen.getByLabelText(/new password/i), { target: { value: 'Password123' } });
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'Password123' } });
    fireEvent.click(screen.getByRole('button', { name: /reset password/i }));

    await waitFor(() => expect(mockToastError).toHaveBeenCalledWith('Invalid or expired reset token'));
    expect(screen.queryByText(/your password has been updated/i)).not.toBeInTheDocument();
  });
});
