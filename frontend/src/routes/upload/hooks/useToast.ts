import { useState, useCallback, useRef, useEffect } from 'react'
import type { Toast } from '../types'

export function useToast() {
	const [toasts, setToasts] = useState<Toast[]>([])
	const timeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map())

	const removeToast = useCallback((id: string) => {
		// Clear timeout if it exists
		const timeout = timeoutsRef.current.get(id)
		if (timeout) {
			clearTimeout(timeout)
			timeoutsRef.current.delete(id)
		}
		setToasts((prev) => prev.filter((t) => t.id !== id))
	}, [])

	const addToast = useCallback((type: Toast['type'], title: string, message: string, duration: number = 5000) => {
		const id = `toast-${Date.now()}-${Math.random().toString(36).substring(7)}`
		setToasts((prev) => [...prev, { id, type, title, message, duration }])
		
		// Clear any existing timeout for this toast (shouldn't happen, but safety)
		const existingTimeout = timeoutsRef.current.get(id)
		if (existingTimeout) {
			clearTimeout(existingTimeout)
		}
		
		// Set new timeout
		const timeout = setTimeout(() => {
			removeToast(id)
		}, duration)
		timeoutsRef.current.set(id, timeout)
	}, [removeToast])

	// Cleanup timeouts on unmount
	useEffect(() => {
		return () => {
			timeoutsRef.current.forEach((timeout) => clearTimeout(timeout))
			timeoutsRef.current.clear()
		}
	}, [])

	return {
		toasts,
		removeToast,
		success: (title: string, message: string) => addToast('success', title, message),
		error: (title: string, message: string) => addToast('error', title, message, 6000), // Errors stay longer
		warning: (title: string, message: string) => addToast('warning', title, message),
		info: (title: string, message: string) => addToast('info', title, message),
	}
}
