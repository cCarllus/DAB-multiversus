export function resolveApiBaseUrl(): string {
  const configuredBaseUrl =
    typeof import.meta.env.VITE_AUTH_API_BASE_URL === 'string' &&
    import.meta.env.VITE_AUTH_API_BASE_URL
      ? import.meta.env.VITE_AUTH_API_BASE_URL
      : 'http://127.0.0.1:4000';

  return configuredBaseUrl.replace(/\/+$/, '');
}
