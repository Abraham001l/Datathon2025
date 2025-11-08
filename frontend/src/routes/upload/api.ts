import type { Submission, Document, Flag } from './types'

// TODO: Replace with your actual API service
export const apiService = {
	// TODO: Implement these methods
	getSubmissions: async (): Promise<Submission[]> => {
		// Placeholder - replace with actual API call
		return []
	},
	getDocuments: async (): Promise<Document[]> => {
		// Placeholder - replace with actual API call
		return []
	},
	uploadDocument: async (file: File): Promise<{ status: string; filepath: string; message?: string }> => {
		// Placeholder - replace with actual API call
		void file // Mark as intentionally unused
		return { status: 'success', filepath: '' }
	},
	submitDocument: async (
		filepath: string,
		projectSpecs: string,
		clearance: string
	): Promise<{ status: string; submission_id?: string; message?: string }> => {
		// Placeholder - replace with actual API call
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
		// Placeholder - replace with actual API call
		void submissionId
		return { ai_flags: [], verified_flags: [] }
	},
}
