/**
 * API Client with JWT Authentication
 * 
 * FE-AUTH-02: Centralized API client with Authorization header injection
 * - Adds JWT token to all requests
 * - Handles 401 responses (logout)
 * - Provides typed error handling
 */

import { config } from '../config';

const BACKEND_URL = config.backendUrl;

// Token storage key
const TOKEN_KEY = 'rappit_auth_token';

// ============================================================
// TOKEN MANAGEMENT
// ============================================================

export function getAuthToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(TOKEN_KEY);
}

export function setAuthToken(token: string): void {
    if (typeof window !== 'undefined') {
        localStorage.setItem(TOKEN_KEY, token);
    }
}

export function clearAuthToken(): void {
    if (typeof window !== 'undefined') {
        localStorage.removeItem(TOKEN_KEY);
    }
}

// ============================================================
// API ERROR
// ============================================================

export class ApiError extends Error {
    constructor(
        public status: number,
        message: string,
        public code?: string
    ) {
        super(message);
        this.name = 'ApiError';
    }
}

// ============================================================
// LOGOUT HANDLER
// ============================================================

let logoutHandler: (() => void) | null = null;

export function setLogoutHandler(handler: () => void): void {
    logoutHandler = handler;
}

function handleUnauthorized(): void {
    clearAuthToken();
    if (logoutHandler) {
        logoutHandler();
    } else {
        // Fallback: redirect to login
        if (typeof window !== 'undefined') {
            window.location.href = '/login';
        }
    }
}

// ============================================================
// API REQUEST
// ============================================================

export async function apiRequest<T>(
    endpoint: string,
    options?: RequestInit
): Promise<T> {
    const token = getAuthToken();

    const headers: HeadersInit = {
        'Content-Type': 'application/json',
        ...options?.headers,
    };

    // FE-AUTH-02: Add Authorization header if token exists
    if (token) {
        (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
    }

    const url = endpoint.startsWith('http') ? endpoint : `${BACKEND_URL}${endpoint}`;

    const res = await fetch(url, {
        ...options,
        credentials: 'include',
        headers,
    });

    // FE-AUTH-02: Handle 401 - clear token and redirect
    if (res.status === 401) {
        handleUnauthorized();
        throw new ApiError(401, 'Session expired. Please login again.');
    }

    if (!res.ok) {
        let message = `Request failed with status ${res.status}`;
        let code: string | undefined;

        try {
            const errorData = await res.json();
            message = errorData.message || message;
            code = errorData.code;
        } catch {
            // Use default message
        }

        throw new ApiError(res.status, message, code);
    }

    // Handle empty responses
    const text = await res.text();
    if (!text) {
        return {} as T;
    }

    return JSON.parse(text);
}

// ============================================================
// CONVENIENCE METHODS
// ============================================================

export const api = {
    get: <T>(endpoint: string, options?: RequestInit) =>
        apiRequest<T>(endpoint, { ...options, method: 'GET' }),

    post: <T>(endpoint: string, body?: unknown, options?: RequestInit) =>
        apiRequest<T>(endpoint, {
            ...options,
            method: 'POST',
            body: body ? JSON.stringify(body) : undefined,
        }),

    put: <T>(endpoint: string, body?: unknown, options?: RequestInit) =>
        apiRequest<T>(endpoint, {
            ...options,
            method: 'PUT',
            body: body ? JSON.stringify(body) : undefined,
        }),

    patch: <T>(endpoint: string, body?: unknown, options?: RequestInit) =>
        apiRequest<T>(endpoint, {
            ...options,
            method: 'PATCH',
            body: body ? JSON.stringify(body) : undefined,
        }),

    delete: <T>(endpoint: string, options?: RequestInit) =>
        apiRequest<T>(endpoint, { ...options, method: 'DELETE' }),
};

export default api;
