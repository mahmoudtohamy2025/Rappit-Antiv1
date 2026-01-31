/**
 * Authentication API
 * 
 * FE-AUTH-01: Real authentication API integration
 * - Login with credentials
 * - Token management
 * - Logout
 */

import { api, setAuthToken, clearAuthToken, ApiError } from './client';
import { config } from '../config';

// ============================================================
// TYPES
// ============================================================

export interface LoginCredentials {
    email: string;
    password: string;
}

export interface LoginResponse {
    accessToken: string;
    user: {
        id: string;
        email: string;
        name: string;
        role: string;
        organizationId: string;
    };
}

export interface User {
    id: string;
    email: string;
    name: string;
    role: string;
    organizationId: string;
}

// ============================================================
// AUTH API
// ============================================================

/**
 * Login with email and password
 * FE-AUTH-01: Wire login to real API
 */
export async function login(credentials: LoginCredentials): Promise<LoginResponse> {
    // Use mock data if configured
    if (config.useMockData) {
        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 500));

        // Mock successful login
        const mockResponse: LoginResponse = {
            accessToken: 'mock-jwt-token-' + Date.now(),
            user: {
                id: 'user-1',
                email: credentials.email,
                name: 'أحمد محمد',
                role: 'ADMIN',
                organizationId: 'org-1',
            },
        };

        setAuthToken(mockResponse.accessToken);
        return mockResponse;
    }

    const response = await api.post<LoginResponse>('/auth/login', credentials);

    // Store the token
    setAuthToken(response.accessToken);

    return response;
}

/**
 * Logout - clear token and session
 */
export async function logout(): Promise<void> {
    try {
        // Try to notify backend (optional, may fail if token expired)
        if (!config.useMockData) {
            await api.post('/auth/logout');
        }
    } catch {
        // Ignore errors - just clear local state
    } finally {
        clearAuthToken();
    }
}

/**
 * Get current user info
 */
export async function getCurrentUser(): Promise<User> {
    if (config.useMockData) {
        return {
            id: 'user-1',
            email: 'admin@example.com',
            name: 'أحمد محمد',
            role: 'ADMIN',
            organizationId: 'org-1',
        };
    }

    return api.get<User>('/auth/me');
}

/**
 * Check if user is authenticated
 */
export function isAuthenticated(): boolean {
    if (typeof window === 'undefined') return false;
    return !!localStorage.getItem('rappit_auth_token');
}

export { ApiError };
