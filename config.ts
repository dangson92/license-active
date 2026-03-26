// Config for API endpoints
export const config = {
  // Main API domain (qua CloudFlare)
  apiUrl: import.meta.env.VITE_API_URL || 'https://app.phanmemauto.com',

  // Upload API domain (KHÔNG qua CloudFlare - no 100MB limit)
  uploadApiUrl: import.meta.env.VITE_UPLOAD_API_URL || 'https://upload.phanmemauto.com',

  // Asset API URL for static files (icons, uploads, etc.)
  assetApiUrl: import.meta.env.VITE_API_URL || 'https://api.phanmemauto.com',
}
