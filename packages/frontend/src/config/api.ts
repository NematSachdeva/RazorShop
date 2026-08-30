// API client configuration
// In production (or when VITE_API_URL is set), use same-origin relative path '/api'
// In local development (Vite dev server), fallback to local backend 'http://localhost:3000/api'

export const API_BASE_URL: string =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.PROD ? '/api' : 'http://localhost:3000/api');

export const getApiUrl = (path: string): string => {
  const basePath = API_BASE_URL.replace(/\/+$/, '');
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${basePath}${cleanPath}`;
};
