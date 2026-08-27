import { getApiUrl } from '../config/api';
class AuthService {
    constructor() {
        Object.defineProperty(this, "tokenKey", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'auth_token'
        });
        Object.defineProperty(this, "userKey", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'auth_user'
        });
    }
    /**
     * Register a new user
     */
    async register(email, password, name) {
        const response = await fetch(getApiUrl('/auth/register'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, name, role: 'customer' }),
        });
        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.error || 'Registration failed');
        }
        const data = await response.json();
        this.storeToken(data.token);
        this.storeUser({ id: data.id, email: data.email, name: data.name, role: data.role });
        return data;
    }
    /**
     * Login with email and password
     */
    async login(email, password) {
        const response = await fetch(getApiUrl('/auth/login'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
        });
        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.error || 'Login failed');
        }
        const data = await response.json();
        this.storeToken(data.token);
        this.storeUser({ id: data.id, email: data.email, name: data.name, role: data.role });
        return data;
    }
    /**
     * Logout user
     */
    logout() {
        localStorage.removeItem(this.tokenKey);
        localStorage.removeItem(this.userKey);
    }
    /**
     * Get stored token
     */
    getToken() {
        return localStorage.getItem(this.tokenKey);
    }
    /**
     * Get stored user info
     */
    getUser() {
        const user = localStorage.getItem(this.userKey);
        return user ? JSON.parse(user) : null;
    }
    /**
     * Check if user is authenticated
     */
    isAuthenticated() {
        return !!this.getToken();
    }
    /**
     * Get Authorization header value
     */
    getAuthHeader() {
        const token = this.getToken();
        return token ? { Authorization: `Bearer ${token}` } : {};
    }
    /**
     * Store token in localStorage
     */
    storeToken(token) {
        localStorage.setItem(this.tokenKey, token);
    }
    /**
     * Store user info in localStorage
     */
    storeUser(user) {
        localStorage.setItem(this.userKey, JSON.stringify(user));
    }
}
export const authService = new AuthService();
