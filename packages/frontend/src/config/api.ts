// API client configuration
// Uses environment variable set at build time

export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export const getApiUrl = (path: string): string => {
  return `${API_BASE_URL}${path}`;
};
