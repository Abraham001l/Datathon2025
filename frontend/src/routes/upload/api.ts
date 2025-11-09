import type { Submission, Document, Flag } from './types'
import { API_BASE_URL } from '../../utils/apiConfig'

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
		console.log()
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
			summary?: string
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
	getDocumentImages: async (
		file_id: string
	): Promise<Array<{
		page: number
		image_index: number
		xref: number
		extension: string
		size_bytes: number
		bounding_box: {
			x0: number
			y0: number
			x1: number
			y1: number
			width: number
			height: number
		}
		page_width: number
		page_height: number
		safe_search: {
			adult: string
			spoof: string
			medical: string
			violence: string
			racy: string
		}
	}>> => {
		const response = await fetch(`${API_BASE_URL}/view/document/${file_id}/images`)
		if (!response.ok) {
			const errorData = await response.json().catch(() => ({ detail: 'Failed to fetch document images' }))
			throw new Error(errorData.detail || `HTTP error! status: ${response.status}`)
		}
		return await response.json()
	},
}
