const DEFAULT_API_BASE_URL = 'http://localhost:3000';

export const apiBaseUrl =
  import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '') || DEFAULT_API_BASE_URL;
