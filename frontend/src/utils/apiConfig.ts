/**
 * Auto-detects the API base URL based on the current origin.
 * Uses Vite proxy (/api) when available, otherwise falls back to direct backend URL.
 */
function getApiBaseUrl(): string {
	// If explicitly set via environment variable, use that
	if (import.meta.env.VITE_API_BASE_URL) {
		const url = import.meta.env.VITE_API_BASE_URL
		if (typeof window !== 'undefined') {
			console.log('[API Config] Using explicit API URL from environment:', url)
		}
		return url
	}

	// Check if we should use the Vite proxy (in development or when proxy is configured)
	// The proxy is configured in vite.config.ts to rewrite /api to the backend
	const useProxy = import.meta.env.DEV || import.meta.env.VITE_USE_PROXY === 'true'
	
	if (useProxy) {
		// Use relative path /api which will be proxied by Vite
		const url = '/api'
		if (typeof window !== 'undefined') {
			console.log('[API Config] Using Vite proxy:', url)
		}
		return url
	}

	// Production: Auto-detect based on current origin
	if (typeof window !== 'undefined') {
		const origin = window.location.origin
		
		// If we're on localhost, use localhost for API
		if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
			const url = 'http://localhost:8000'
			console.log('[API Config] Detected localhost, using:', url)
			return url
		}
		
		// If we're on a public IP or domain, use the same host with port 8000
		try {
			const url = new URL(origin)
			const apiUrl = `${url.protocol}//${url.hostname}:8000`
			console.log('[API Config] Auto-detected API URL from origin:', apiUrl)
			return apiUrl
		} catch {
			// Fallback if URL parsing fails
			const url = 'http://localhost:8000'
			console.warn('[API Config] Failed to parse origin, using fallback:', url)
			return url
		}
	}

	// Server-side or fallback
	return 'http://localhost:8000'
}

export const API_BASE_URL = getApiBaseUrl()

