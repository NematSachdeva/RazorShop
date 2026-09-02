// API client configuration
// In production (or when VITE_API_URL is set), use same-origin relative path '/api'
// In local development (Vite dev server), fallback to local backend 'http://localhost:3000/api'

export const API_BASE_URL: string =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.PROD || import.meta.env.MODE === 'production'
    ? '/api'
    : typeof window !== 'undefined'
    ? `http://${window.location.hostname || 'localhost'}:3000/api`
    : 'http://localhost:3000/api');

export const getApiUrl = (path: string): string => {
  const basePath = API_BASE_URL.replace(/\/+$/, '');
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${basePath}${cleanPath}`;
};

export const getImageUrl = (url?: string | null): string | undefined => {
  if (!url || typeof url !== 'string' || !url.trim()) return undefined;
  let trimmed = url.trim();

  // Extract direct image URL if user pasted a Google Search / Imgres redirect link
  if (trimmed.includes('google.com/imgres') || trimmed.includes('google.com/url')) {
    try {
      const parsed = new URL(trimmed);
      const targetParam = parsed.searchParams.get('imgurl') || parsed.searchParams.get('url');
      if (targetParam && (targetParam.startsWith('http://') || targetParam.startsWith('https://'))) {
        trimmed = targetParam;
      }
    } catch {
      // Keep trimmed if URL parsing fails
    }
  }

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('data:')) {
    return trimmed;
  }
  const serverBase = API_BASE_URL.replace(/\/api\/?$/, '');
  const cleanPath = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return `${serverBase}${cleanPath}`;
};
