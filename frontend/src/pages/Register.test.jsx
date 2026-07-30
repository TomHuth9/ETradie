import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';

const mockRegister = vi.fn();

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    register: (...args) => mockRegister(...args),
  }),
}));

import Register from './Register';

describe('Register page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('defaults to the homeowner role and shows address fields, not town/city', () => {
    render(<MemoryRouter><Register /></MemoryRouter>);

    expect(screen.getByLabelText(/address line 1/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/town \/ city/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/postcode/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/^town or city$/i)).not.toBeInTheDocument();
  });

  test('switching to tradesperson shows town/city and hides the address fields', () => {
    render(<MemoryRouter><Register /></MemoryRouter>);

    fireEvent.click(screen.getByRole('button', { name: /tradesperson/i }));

    expect(screen.getByLabelText(/^town or city$/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/address line 1/i)).not.toBeInTheDocument();
  });

  test('shows a field-level validation error on blur for an empty required field', () => {
    render(<MemoryRouter><Register /></MemoryRouter>);

    const nameInput = screen.getByLabelText(/full name/i);
    fireEvent.blur(nameInput);

    expect(screen.getByText(/name is required/i)).toBeInTheDocument();
  });

  test('does not call register when submitting with required fields empty', () => {
    render(<MemoryRouter><Register /></MemoryRouter>);

    // Every required input also carries the native HTML `required` attribute,
    // so submitting an empty form is blocked by the browser's own constraint
    // validation before React's onSubmit (and this component's validateForm)
    // ever runs — jsdom enforces this the same way a real browser does.
    fireEvent.click(screen.getByRole('button', { name: /create account/i }));

    expect(mockRegister).not.toHaveBeenCalled();
  });

  test('submits a valid homeowner registration with the structured address payload', async () => {
    mockRegister.mockResolvedValue({});
    render(<MemoryRouter><Register /></MemoryRouter>);

    fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: 'Grace Homeowner' } });
    fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'grace@example.com' } });
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'Password123' } });
    fireEvent.change(screen.getByLabelText(/address line 1/i), { target: { value: '42 Example Street' } });
    fireEvent.change(screen.getByLabelText(/town \/ city/i), { target: { value: 'Glasgow' } });
    fireEvent.change(screen.getByLabelText(/postcode/i), { target: { value: 'G1 1AA' } });

    fireEvent.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => expect(mockRegister).toHaveBeenCalledTimes(1));
    expect(mockRegister).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Grace Homeowner',
      email: 'grace@example.com',
      password: 'Password123',
      role: 'homeowner',
      addressLine1: '42 Example Street',
      addressCity: 'Glasgow',
      addressPostcode: 'G1 1AA',
    }));
  });

  test('submits a valid tradesperson registration with townOrCity', async () => {
    mockRegister.mockResolvedValue({});
    render(<MemoryRouter><Register /></MemoryRouter>);

    fireEvent.click(screen.getByRole('button', { name: /tradesperson/i }));
    fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: 'Tom Tradesperson' } });
    fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'tom@example.com' } });
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'Password123' } });
    fireEvent.change(screen.getByLabelText(/^town or city$/i), { target: { value: 'Glasgow' } });

    fireEvent.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => expect(mockRegister).toHaveBeenCalledTimes(1));
    expect(mockRegister).toHaveBeenCalledWith(expect.objectContaining({
      role: 'tradesperson',
      townOrCity: 'Glasgow',
    }));
  });

  test('shows the server error message when registration fails', async () => {
    mockRegister.mockRejectedValue({ response: { data: { message: 'A user with that email already exists' } } });
    render(<MemoryRouter><Register /></MemoryRouter>);

    fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: 'Grace Homeowner' } });
    fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'grace@example.com' } });
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'Password123' } });
    fireEvent.change(screen.getByLabelText(/address line 1/i), { target: { value: '42 Example Street' } });
    fireEvent.change(screen.getByLabelText(/town \/ city/i), { target: { value: 'Glasgow' } });
    fireEvent.change(screen.getByLabelText(/postcode/i), { target: { value: 'G1 1AA' } });

    fireEvent.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => {
      expect(screen.getByText(/a user with that email already exists/i)).toBeInTheDocument();
    });
  });
});
