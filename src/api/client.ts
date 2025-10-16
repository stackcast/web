import { apiBaseUrl } from '@/lib/config'

/**
 * Base API client - handles all HTTP requests with proper error handling
 */

interface RequestOptions extends RequestInit {
  skipJson?: boolean
}

/**
 * Generic fetch wrapper with error handling and JSON parsing
 */
export async function apiRequest<T>(
  path: string,
  { skipJson, ...init }: RequestOptions = {}
): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers || {})
    },
    ...init
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(text || `Request failed with status ${response.status}`)
  }

  if (skipJson) {
    return undefined as T
  }

  return response.json() as Promise<T>
}
