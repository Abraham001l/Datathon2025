import type { Submission, Document, Flag } from './types'

// API base URL - defaults to localhost:8000, can be overridden with environment variable
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

export const apiService = {
	// TODO: Implement these methods when backend endpoints are available
	getSubmissions: async (): Promise<Submission[]> => {
		// Placeholder - replace with actual API call when endpoint is created
		return []
	},
	getDocuments: async (limit?: number, skip?: number): Promise<{ files: Document[]; count: number }> => {
		try {
			const params = new URLSearchParams()
			if (limit !== undefined) {
				params.append('limit', limit.toString())
			}
			if (skip !== undefined) {
				params.append('skip', skip.toString())
			}

			const queryString = params.toString()
			const url = `${API_BASE_URL}/view/document${queryString ? `?${queryString}` : ''}`

			const response = await fetch(url, {
				method: 'GET',
			})

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({ detail: 'Failed to fetch documents' }))
				throw new Error(errorData.detail || `HTTP error! status: ${response.status}`)
			}

			const data = await response.json()
			return {
				files: data.files || [],
				count: data.count || 0,
			}
		} catch (error) {
			console.error('Error fetching documents:', error)
			throw error
		}
	},
	uploadDocument: async (
		file: File,
		description?: string,
		category?: string
	): Promise<{ status: string; filepath: string; file_id?: string; message?: string }> => {
		try {
			const formData = new FormData()
			formData.append('file', file)
			
			if (description) {
				formData.append('description', description)
			}
			if (category) {
				formData.append('category', category)
			}

			const response = await fetch(`${API_BASE_URL}/parse/parse-pdf`, {
				method: 'POST',
				body: formData,
			})

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({ detail: 'Upload failed' }))
				throw new Error(errorData.detail || `HTTP error! status: ${response.status}`)
			}

			const data = await response.json()
			
			return {
				status: 'success',
				filepath: data.filename || file.name,
				file_id: data.pdf_file_id || data.file_id,
				message: data.message,
			}
		} catch (error) {
			console.error('Upload error:', error)
			throw error
		}
	},
	submitDocument: async (
		filepath: string,
		projectSpecs: string,
		clearance: string
	): Promise<{ status: string; submission_id?: string; message?: string }> => {
		// TODO: Create backend endpoint for document submission
		// For now, this is a placeholder that simulates success
		// In the future, this should call a POST /submissions endpoint
		void filepath
		void projectSpecs
		void clearance
		return { status: 'success', submission_id: '' }
	},
	getSubmissionFlags: async (submissionId: string): Promise<{
		ai_flags: Flag[]
		verified_flags: Flag[]
		reviewer_notes?: string
	}> => {
		// TODO: Create backend endpoint for getting submission flags
		// Placeholder - replace with actual API call when endpoint is created
		void submissionId
		return { ai_flags: [], verified_flags: [], reviewer_notes: '' }
	},
	getDocumentBoundingBoxes: async (
		file_id: string
	): Promise<Array<{
		page_number: number
		text: string
		bounding_boxes: Array<{
			id?: string
			text: string
			bounding_box: {
				vertices: Array<{ x: number; y: number }>
			}
			type: string
			classification?: string
			confidence?: string | number
			explanation?: string
		}>
		dimensions?: Record<string, unknown>
	}>> => {
		const response = await fetch(`${API_BASE_URL}/view/document/${file_id}/bounding_boxes`)
		if (!response.ok) {
			const errorData = await response.json().catch(() => ({ detail: 'Failed to fetch document bounding boxes' }))
			throw new Error(errorData.detail || `HTTP error! status: ${response.status}`)
		}
		return await response.json()
	},
}
