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

import ForgotPassword from './ForgotPassword';

describe('ForgotPassword page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders the email field and submit button', () => {
    render(<MemoryRouter><ForgotPassword /></MemoryRouter>);
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send reset link/i })).toBeInTheDocument();
  });

  test('does not call the API when submitting with an empty email', () => {
    render(<MemoryRouter><ForgotPassword /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: /send reset link/i }));
    expect(mockPost).not.toHaveBeenCalled();
  });

  test('shows a validation error for a malformed email (custom validation, bypassing native)', () => {
    const { container } = render(<MemoryRouter><ForgotPassword /></MemoryRouter>);
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'not-a-real-email' } });
    // Dispatch submit directly on the form — clicking the submit button goes
    // through the browser's native constraint validation first (type="email"),
    // which would intercept some malformed values before this component's own
    // validateEmail ever runs. Submitting the form directly exercises the
    // app's own validation logic specifically.
    fireEvent.submit(container.querySelector('form'));

    expect(screen.getByText(/valid email/i)).toBeInTheDocument();
    expect(mockPost).not.toHaveBeenCalled();
  });

  test('submits the trimmed email and shows the confirmation screen on success', async () => {
    mockPost.mockResolvedValue({ data: {} });
    render(<MemoryRouter><ForgotPassword /></MemoryRouter>);

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: '  grace@example.com  ' } });
    fireEvent.click(screen.getByRole('button', { name: /send reset link/i }));

    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/auth/forgot-password', { email: 'grace@example.com' }));
    await waitFor(() => {
      expect(screen.getByText(/check your email/i)).toBeInTheDocument();
    });
    expect(mockToastSuccess).toHaveBeenCalled();
  });

  test('shows an error toast when the request fails', async () => {
    mockPost.mockRejectedValue({ response: { data: { message: 'Server error' } } });
    render(<MemoryRouter><ForgotPassword /></MemoryRouter>);

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'grace@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: /send reset link/i }));

    await waitFor(() => expect(mockToastError).toHaveBeenCalledWith('Server error'));
    expect(screen.queryByText(/check your email/i)).not.toBeInTheDocument();
  });
});
