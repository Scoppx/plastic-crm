import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Login from '../src/pages/Login';

const useAuth = vi.fn();
vi.mock('../src/auth/AuthContext', () => ({ useAuth: () => useAuth() }));

afterEach(cleanup);

describe('Login', () => {
  it('shows the loading placeholder instead of the form while the session is being checked', () => {
    useAuth.mockReturnValue({ status: 'loading' });
    render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><Login /></MemoryRouter>);
    expect(screen.getByText('Caricamento…')).toBeTruthy();
    expect(screen.queryByText('Accedi')).toBeNull();
  });

  it('shows the form once signed out', () => {
    useAuth.mockReturnValue({ status: 'signedOut' });
    render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><Login /></MemoryRouter>);
    expect(screen.getByText('Accedi')).toBeTruthy();
  });
});
