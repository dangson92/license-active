import { config } from '../config';

interface LoginResponse {
  token: string;
}

interface RegisterResponse {
  token: string;
}

interface DecodedToken {
  id: string;
  email: string;
  role: 'user' | 'admin';
  exp: number;
}

// JWT token management
const TOKEN_KEY = 'auth_token';

export const saveToken = (token: string) => {
  localStorage.setItem(TOKEN_KEY, token);
};

export const getToken = (): string | null => {
  return localStorage.getItem(TOKEN_KEY);
};

export const removeToken = () => {
  localStorage.removeItem(TOKEN_KEY);
};

// Decode JWT token (simple base64 decode - without verification)
export const decodeToken = (token: string): DecodedToken | null => {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const payload = JSON.parse(atob(parts[1]));
    return payload as DecodedToken;
  } catch (e) {
    console.error('Failed to decode token:', e);
    return null;
  }
};

// Get current user from token
export const getCurrentUser = (): DecodedToken | null => {
  const token = getToken();
  if (!token) return null;

  const decoded = decodeToken(token);
  if (!decoded) return null;

  // Check if token is expired
  if (decoded.exp * 1000 < Date.now()) {
    removeToken();
    return null;
  }

  return decoded;
};

// API client with authentication
const apiCall = async (endpoint: string, options: RequestInit = {}) => {
  const token = getToken();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${config.API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(errorData.error || `HTTP ${response.status}`);
  }

  return response.json();
};

// Authentication endpoints
export const api = {
  auth: {
    login: async (email: string, password: string): Promise<LoginResponse> => {
      const response = await apiCall('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });

      if (response.token) {
        saveToken(response.token);
      }

      return response;
    },

    register: async (email: string, password: string, fullName: string): Promise<RegisterResponse> => {
      const response = await apiCall('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email, password, fullName }),
      });

      if (response.token) {
        saveToken(response.token);
      }

      return response;
    },

    logout: () => {
      removeToken();
    },
  },

  // Placeholder for other API endpoints
  licenses: {
    // TODO: Add license management endpoints
  },

  activations: {
    // TODO: Add activation endpoints
  },
};

export default api;
