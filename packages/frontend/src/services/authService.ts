import { getApiUrl } from '../config/api';

export interface AuthResponse {
  id: string;
  email: string;
  name?: string;
  role: 'customer' | 'merchant';
  token: string;
}

export interface User {
  id: string;
  email: string;
  name?: string;
  role: 'customer' | 'merchant';
}

class AuthService {
  private readonly tokenKey = 'auth_token';
  private readonly userKey = 'auth_user';

  /**
   * Register a new user
   */
  async register(email: string, password: string, name?: string, role: 'customer' | 'merchant' = 'customer'): Promise<AuthResponse> {
    const response = await fetch(getApiUrl('/auth/register'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name, role }),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Registration failed');
    }

    const data: AuthResponse = await response.json();
    this.storeToken(data.token);
    this.storeUser({ id: data.id, email: data.email, name: data.name, role: data.role });
    return data;
  }

  /**
   * Login with email and password
   */
  async login(email: string, password: string): Promise<AuthResponse> {
    const response = await fetch(getApiUrl('/auth/login'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Login failed');
    }

    const data: AuthResponse = await response.json();
    this.storeToken(data.token);
    this.storeUser({ id: data.id, email: data.email, name: data.name, role: data.role });
    return data;
  }

  /**
   * Logout user
   */
  logout(): void {
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem(this.userKey);
  }

  /**
   * Get stored token
   */
  getToken(): string | null {
    return localStorage.getItem(this.tokenKey);
  }

  /**
   * Get stored user info
   */
  getUser(): User | null {
    const user = localStorage.getItem(this.userKey);
    return user ? JSON.parse(user) : null;
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return !!this.getToken();
  }

  /**
   * Get Authorization header value
   */
  getAuthHeader(): { Authorization: string } | {} {
    const token = this.getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  /**
   * Store token in localStorage
   */
  private storeToken(token: string): void {
    localStorage.setItem(this.tokenKey, token);
  }

  /**
   * Store user info in localStorage
   */
  private storeUser(user: User): void {
    localStorage.setItem(this.userKey, JSON.stringify(user));
  }
}

export const authService = new AuthService();
