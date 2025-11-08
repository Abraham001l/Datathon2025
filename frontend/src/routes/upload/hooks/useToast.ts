import { useState } from 'react'
import type { Toast } from '../types'

// Simple toast notification system (TODO: Replace with your toast hook/component if needed)
export function useToast() {
	const [toasts, setToasts] = useState<Toast[]>([])

	const removeToast = (id: string) => {
		setToasts((prev) => prev.filter((t) => t.id !== id))
	}

	const addToast = (type: Toast['type'], title: string, message: string) => {
		const id = Math.random().toString(36).substring(7)
		setToasts((prev) => [...prev, { id, type, title, message }])
		setTimeout(() => removeToast(id), 5000)
	}

	return {
		toasts,
		removeToast,
		success: (title: string, message: string) => addToast('success', title, message),
		error: (title: string, message: string) => addToast('error', title, message),
		warning: (title: string, message: string) => addToast('warning', title, message),
		info: (title: string, message: string) => addToast('info', title, message),
	}
}
