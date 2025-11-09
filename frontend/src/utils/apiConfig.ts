/**
 * Auto-detects the API base URL based on the current origin.
 * This handles cases where the frontend is hosted on a public IP
 * and needs to access the backend on the same IP.
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

	// Auto-detect based on current origin
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

