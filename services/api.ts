import { config } from '../config';

// Helper to get full URL for assets (icons, uploads, etc.)
// Converts relative path like "/uploads/icons/file.png" to full API URL
export const getAssetUrl = (relativePath: string | undefined | null): string | null => {
  if (!relativePath) return null;
  // If already a full URL, return as-is
  if (relativePath.startsWith('http://') || relativePath.startsWith('https://')) {
    return relativePath;
  }
  // Use API base URL for assets from config (VITE_API_URL)
  return `${config.assetApiUrl}${relativePath}`;
};

interface LoginResponse {
  token: string;
}

interface RegisterResponse {
  token?: string;
  requiresVerification?: boolean;
  message?: string;
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

  const response = await fetch(`${config.apiUrl}${endpoint}`, {
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
      const response = await apiCall('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });

      if (response.token) {
        saveToken(response.token);
      }

      return response;
    },

    register: async (email: string, password: string, fullName: string): Promise<RegisterResponse> => {
      const response = await apiCall('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email, password, fullName }),
      });

      if (response.token) {
        saveToken(response.token);
      }

      return response;
    },

    verifyEmail: async (token: string) => {
      return apiCall('/api/auth/verify-email', {
        method: 'POST',
        body: JSON.stringify({ token }),
      });
    },

    resendVerification: async (email: string) => {
      return apiCall('/api/auth/resend-verification', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
    },

    logout: () => {
      removeToken();
    },
  },

  // Settings endpoints
  settings: {
    get: async () => {
      return apiCall('/api/admin/settings');
    },

    // Get public payment settings (bank info for checkout)
    getPaymentSettings: async () => {
      return apiCall('/api/admin/settings/payment');
    },

    update: async (settings: Record<string, string>) => {
      return apiCall('/api/admin/settings', {
        method: 'PUT',
        body: JSON.stringify(settings),
      });
    },

    testEmail: async (to: string) => {
      return apiCall('/api/admin/settings/test-email', {
        method: 'POST',
        body: JSON.stringify({ to }),
      });
    },
  },

  // Admin endpoints
  admin: {
    // Apps
    getApps: async () => {
      return apiCall('/api/admin/apps');
    },

    getApp: async (id: number) => {
      return apiCall(`/api/admin/apps/${id}`);
    },

    createApp: async (data: { code: string; name: string; description?: string }) => {
      return apiCall('/api/admin/apps', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    updateApp: async (id: number, data: { name?: string; description?: string; is_active?: boolean }) => {
      return apiCall(`/api/admin/apps/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
    },

    uploadAppIcon: async (id: number, file: File) => {
      const formData = new FormData();
      formData.append('icon', file);

      const token = getToken();
      const headers: HeadersInit = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`${config.apiUrl}/api/admin/apps/${id}/icon`, {
        method: 'POST',
        headers,
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      return response.json();
    },

    deleteApp: async (id: number) => {
      return apiCall(`/api/admin/apps/${id}`, {
        method: 'DELETE',
      });
    },

    // Users
    getUsers: async () => {
      return apiCall('/api/admin/users');
    },

    updateUser: async (id: number, data: { full_name?: string; role?: string; email_verified?: boolean }) => {
      return apiCall(`/api/admin/users/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
    },

    deleteUser: async (id: number) => {
      return apiCall(`/api/admin/users/${id}`, {
        method: 'DELETE',
      });
    },

    // Licenses
    getLicenses: async (filters?: { user_id?: number; app_id?: number; status?: string }) => {
      const params = new URLSearchParams();
      if (filters?.user_id) params.append('user_id', filters.user_id.toString());
      if (filters?.app_id) params.append('app_id', filters.app_id.toString());
      if (filters?.status) params.append('status', filters.status);

      const query = params.toString();
      return apiCall(`/api/admin/licenses${query ? '?' + query : ''}`);
    },

    createLicense: async (data: {
      user_id: number;
      app_id: number;
      max_devices: number;
      expires_at?: string;
      status?: string;
    }) => {
      return apiCall('/api/admin/licenses', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    getLicenseDetails: async (id: number) => {
      return apiCall(`/api/admin/licenses/${id}`);
    },

    updateLicense: async (id: number, data: {
      expires_at?: string;
      status?: string;
      max_devices?: number;
      user_id?: number;
      meta?: any;
    }) => {
      return apiCall(`/api/admin/licenses/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
    },

    deleteLicense: async (id: number) => {
      return apiCall(`/api/admin/licenses/${id}`, {
        method: 'DELETE',
      });
    },

    revokeLicense: async (id: number) => {
      return apiCall(`/api/admin/licenses/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'revoked' }),
      });
    },

    extendLicense: async (id: number, additionalMonths: number) => {
      return apiCall(`/api/admin/licenses/${id}/extend`, {
        method: 'POST',
        body: JSON.stringify({ additionalMonths }),
      });
    },

    transferLicense: async (id: number, newUserId: number) => {
      return apiCall(`/api/admin/licenses/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ user_id: newUserId }),
      });
    },

    removeDevice: async (licenseId: number, deviceId: string) => {
      return apiCall(`/api/admin/licenses/${licenseId}/devices/${deviceId}`, {
        method: 'DELETE',
      });
    },

    // App Versions
    getAppVersions: async (appId: number) => {
      return apiCall(`/api/admin/app-versions/${appId}`);
    },

    getLatestVersion: async (appId: number) => {
      return apiCall(`/api/admin/app-versions/latest/${appId}`);
    },

    createAppVersion: async (data: {
      app_id: number;
      version: string;
      release_date: string;
      release_notes?: string;
      download_url: string;
      file_name?: string;
      file_size?: number;
      mandatory?: boolean;
      platform?: string;
      file_type?: string;
    }) => {
      return apiCall('/api/admin/app-versions', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    updateAppVersion: async (id: number, data: {
      version?: string;
      release_date?: string;
      release_notes?: string;
      download_url?: string;
      file_name?: string;
      file_size?: number;
      mandatory?: boolean;
      platform?: string;
      file_type?: string;
    }) => {
      return apiCall(`/api/admin/app-versions/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    },

    deleteAppVersion: async (id: number) => {
      return apiCall(`/api/admin/app-versions/${id}`, {
        method: 'DELETE',
      });
    },

    uploadVersionFile: async (file: File, appCode: string, version: string) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('appCode', appCode);
      formData.append('version', version);

      const token = getToken();
      const headers: HeadersInit = {};

      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`${config.uploadApiUrl}/api/admin/app-versions/upload`, {
        method: 'POST',
        headers,
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      return response.json();
    },
  },

  // User endpoints
  user: {
    // Get licenses for current user
    getLicenses: async () => {
      return apiCall('/api/user/licenses');
    },

    // Get license details
    getLicenseDetails: async (id: number) => {
      return apiCall(`/api/user/licenses/${id}`);
    },

    // Request license renewal
    requestRenewal: async (licenseId: number, message?: string) => {
      return apiCall(`/api/user/licenses/${licenseId}/renew-requests`, {
        method: 'POST',
        body: JSON.stringify({ message }),
      });
    },

    // Get renewal requests
    getRenewalRequests: async () => {
      return apiCall('/api/user/renew-requests');
    },
  },

  activations: {
    // TODO: Add activation endpoints if needed
  },

  // Support endpoints
  support: {
    // Get FAQs (public)
    getFaqs: async () => {
      return apiCall('/api/support/faqs');
    },

    // Get my tickets
    getMyTickets: async () => {
      return apiCall('/api/support/tickets');
    },

    // Create ticket
    createTicket: async (data: { subject: string; category: string; message: string }) => {
      return apiCall('/api/support/tickets', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    // Admin: Get all tickets
    getAdminTickets: async (status?: string) => {
      const query = status ? `?status=${status}` : '';
      return apiCall(`/api/support/admin/tickets${query}`);
    },

    // Admin: Update ticket
    updateTicket: async (id: number, data: { status?: string; priority?: string }) => {
      return apiCall(`/api/support/admin/tickets/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
    },

    // Admin: Delete ticket
    deleteTicket: async (id: number) => {
      return apiCall(`/api/support/admin/tickets/${id}`, {
        method: 'DELETE',
      });
    },

    // Admin: Get all FAQs
    getAdminFaqs: async (category?: string) => {
      const query = category ? `?category=${encodeURIComponent(category)}` : '';
      return apiCall(`/api/support/admin/faqs${query}`);
    },

    // Admin: Get FAQ categories (for filter)
    getFaqCategories: async () => {
      return apiCall('/api/support/admin/faq-categories');
    },

    // Admin: Create FAQ
    createFaq: async (data: { question: string; answer: string; category?: string; display_order?: number }) => {
      return apiCall('/api/support/admin/faqs', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    // Admin: Update FAQ
    updateFaq: async (id: number, data: { question?: string; answer?: string; category?: string; display_order?: number; is_active?: boolean }) => {
      return apiCall(`/api/support/admin/faqs/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
    },

    // Admin: Delete FAQ
    deleteFaq: async (id: number) => {
      return apiCall(`/api/support/admin/faqs/${id}`, {
        method: 'DELETE',
      });
    },

    // Admin: Reply to ticket
    replyTicket: async (ticketId: number, message: string) => {
      return apiCall(`/api/support/admin/tickets/${ticketId}/reply`, {
        method: 'POST',
        body: JSON.stringify({ message }),
      });
    },

    // Get ticket replies (user or admin)
    getTicketReplies: async (ticketId: number) => {
      return apiCall(`/api/support/tickets/${ticketId}/replies`);
    },

    // User: Reply to own ticket
    userReplyTicket: async (ticketId: number, message: string) => {
      return apiCall(`/api/support/tickets/${ticketId}/reply`, {
        method: 'POST',
        body: JSON.stringify({ message }),
      });
    },
  },

  // Store endpoints
  store: {
    // Get store apps with pricing
    getApps: async () => {
      return apiCall('/api/store/apps');
    },

    // Get single app
    getApp: async (id: number) => {
      return apiCall(`/api/store/apps/${id}`);
    },

    // Create order
    createOrder: async (data: { app_id: number; quantity: number; duration_months: number; unit_price: number }) => {
      return apiCall('/api/store/orders', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    // Upload receipt
    uploadReceipt: async (orderId: number, file: File) => {
      const formData = new FormData();
      formData.append('receipt', file);

      const token = getToken();
      const headers: HeadersInit = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`${config.apiUrl}/api/store/orders/${orderId}/receipt`, {
        method: 'POST',
        headers,
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      return response.json();
    },

    // Get my orders
    getMyOrders: async () => {
      return apiCall('/api/store/orders');
    },

    // Admin: Get all orders
    getAdminOrders: async (status?: string) => {
      const query = status ? `?status=${status}` : '';
      return apiCall(`/api/store/admin/orders${query}`);
    },

    // Admin: Approve order
    approveOrder: async (orderId: number) => {
      return apiCall(`/api/store/admin/orders/${orderId}/approve`, {
        method: 'POST',
      });
    },

    // Admin: Reject order
    rejectOrder: async (orderId: number, notes?: string) => {
      return apiCall(`/api/store/admin/orders/${orderId}/reject`, {
        method: 'POST',
        body: JSON.stringify({ notes }),
      });
    },

    // Admin: Delete order (and receipt file)
    deleteOrder: async (orderId: number) => {
      return apiCall(`/api/store/admin/orders/${orderId}`, {
        method: 'DELETE',
      });
    },

    // Admin: Get pricing
    getAdminPricing: async () => {
      return apiCall('/api/store/admin/pricing');
    },

    // Admin: Save pricing
    savePricing: async (data: {
      app_id: number;
      description?: string;
      price_1_month?: number;
      price_1_month_enabled?: boolean;
      price_6_months?: number;
      price_6_months_enabled?: boolean;
      price_1_year?: number;
      price_1_year_enabled?: boolean;
      is_active?: boolean;
      is_featured?: boolean;
      badge?: string;
      icon_class?: string;
    }) => {
      return apiCall('/api/store/admin/pricing', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
  },

  // Notifications endpoints
  notifications: {
    // Get all notifications
    getAll: async (unreadOnly = false) => {
      const query = unreadOnly ? '?unread_only=true' : '';
      return apiCall(`/api/notifications${query}`);
    },

    // Get unread count
    getUnreadCount: async () => {
      return apiCall('/api/notifications/unread-count');
    },

    // Mark all as read
    markAllRead: async () => {
      return apiCall('/api/notifications/mark-all-read', {
        method: 'POST',
      });
    },

    // Mark one as read
    markRead: async (id: number) => {
      return apiCall(`/api/notifications/${id}/read`, {
        method: 'PATCH',
      });
    },

    // Delete notification
    delete: async (id: number) => {
      return apiCall(`/api/notifications/${id}`, {
        method: 'DELETE',
      });
    },
  },

  // Announcements endpoints
  announcements: {
    // Get published announcements (public)
    getAll: async (category?: string) => {
      const query = category && category !== 'all' ? `?category=${category}` : '';
      return apiCall(`/api/announcements${query}`);
    },

    // Get single announcement
    getById: async (id: number) => {
      return apiCall(`/api/announcements/${id}`);
    },

    // Admin: Get all announcements with stats
    adminGetAll: async (status?: string) => {
      const query = status ? `?status=${status}` : '';
      return apiCall(`/api/announcements/admin/list${query}`);
    },

    // Admin: Create announcement
    create: async (data: { title: string; content: string; category?: string; is_published?: boolean }) => {
      return apiCall('/api/announcements', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    // Admin: Update announcement
    update: async (id: number, data: { title?: string; content?: string; category?: string }) => {
      return apiCall(`/api/announcements/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    },

    // Admin: Toggle publish status
    togglePublish: async (id: number) => {
      return apiCall(`/api/announcements/${id}/publish`, {
        method: 'PATCH',
      });
    },

    // Admin: Archive announcement
    archive: async (id: number) => {
      return apiCall(`/api/announcements/${id}/archive`, {
        method: 'PATCH',
      });
    },

    // Admin: Delete announcement
    delete: async (id: number) => {
      return apiCall(`/api/announcements/${id}`, {
        method: 'DELETE',
      });
    },
  },
};

export default api;
