import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthProvider, useAuth } from './auth';

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
    back: jest.fn(),
  }),
}));

// Mock the API module
const mockApiPost = jest.fn();
jest.mock('./api', () => ({
  __esModule: true,
  default: {
    post: (...args: any[]) => mockApiPost(...args),
  },
}));

let loginError: Error | null = null;

function TestComponent() {
  const { user, token, login, logout, hasRole } = useAuth();

  const handleLogin = async () => {
    try {
      await login('test@test.com', 'password');
    } catch (e: any) {
      loginError = e;
    }
  };

  return (
    <div>
      <div data-testid="user-name">{user?.name || 'No user'}</div>
      <div data-testid="token">{token || 'No token'}</div>
      <button onClick={handleLogin}>Login</button>
      <button onClick={logout}>Logout</button>
      <div data-testid="is-admin">{hasRole(['ADMIN_IT']) ? 'Yes' : 'No'}</div>
    </div>
  );
}

function renderWithAuth(ui: React.ReactNode) {
  return render(
    <AuthProvider>
      {ui}
    </AuthProvider>
  );
}

describe('AuthProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    loginError = null;
  });

  it('should render children', () => {
    renderWithAuth(<TestComponent />);
    expect(screen.getByTestId('user-name')).toBeInTheDocument();
  });

  describe('login', () => {
    it('should login successfully and store token', async () => {
      mockApiPost.mockResolvedValueOnce({
        data: {
          access_token: 'test-token',
          user: {
            id: 'user-1',
            name: 'Test User',
            email: 'test@test.com',
            role: 'USER',
          },
        },
      });

      renderWithAuth(<TestComponent />);

      await userEvent.click(screen.getByText('Login'));

      await waitFor(() => {
        expect(screen.getByTestId('token')).toHaveTextContent('test-token');
        expect(screen.getByTestId('user-name')).toHaveTextContent('Test User');
      });

      expect(localStorage.getItem('roomflow_token')).toBe('test-token');
    });

    it('should handle login failure gracefully', async () => {
      mockApiPost.mockRejectedValueOnce({
        response: {
          data: { message: 'Invalid credentials' },
        },
      });

      renderWithAuth(<TestComponent />);

      await userEvent.click(screen.getByText('Login'));

      expect(loginError).toBeTruthy();
      expect(screen.getByTestId('token')).toHaveTextContent('No token');
    });
  });

  describe('logout', () => {
    it('should clear token and user from storage', async () => {
      mockApiPost.mockResolvedValueOnce({
        data: {
          access_token: 'test-token',
          user: { id: 'user-1', name: 'Test User', email: 'test@test.com', role: 'USER' },
        },
      });

      renderWithAuth(<TestComponent />);

      await userEvent.click(screen.getByText('Login'));
      await waitFor(() => {
        expect(screen.getByTestId('token')).toHaveTextContent('test-token');
      });

      await userEvent.click(screen.getByText('Logout'));

      expect(screen.getByTestId('token')).toHaveTextContent('No token');
      expect(localStorage.getItem('roomflow_token')).toBeNull();
      expect(localStorage.getItem('roomflow_user')).toBeNull();
    });
  });

  describe('hasRole', () => {
    it('should return false when not admin', async () => {
      mockApiPost.mockResolvedValueOnce({
        data: {
          access_token: 'test-token',
          user: { role: 'ROOM_ADMIN' },
        },
      });

      renderWithAuth(<TestComponent />);

      await userEvent.click(screen.getByText('Login'));

      await waitFor(() => {
        expect(screen.getByTestId('is-admin')).toHaveTextContent('No');
      });
    });

    it('should return true for admin role', async () => {
      mockApiPost.mockResolvedValueOnce({
        data: {
          access_token: 'test-token',
          user: { role: 'ADMIN_IT' },
        },
      });

      renderWithAuth(<TestComponent />);

      await userEvent.click(screen.getByText('Login'));

      await waitFor(() => {
        expect(screen.getByTestId('is-admin')).toHaveTextContent('Yes');
      });
    });
  });
});
