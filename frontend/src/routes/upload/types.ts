// TODO: Replace these placeholder types with your actual types
export type Submission = {
	id: string
	filename: string
	projectSpecs: string
	status: 'in_queue' | 'in_review' | 'accepted' | 'rejected'
	submittedAt: string
	clearance?: string
	// Add other fields as needed
}

export type Document = {
	file_id: string
	filename: string
	upload_date?: string
	length?: number
	content_type?: string
	summary?: string
	metadata?: {
		description?: string
		category?: string
		status?: string
		ai_classified_sensitivity?: string
	}
}

export type SubmissionWithFlags = Submission & {
	aiFlags?: Document[]
	verifiedFlags?: Document[]
	notes?: string
}

export type Flag = {
	clearance: string
	category: string
	page: number
	row: number
	content?: string
	reason?: string
}

export type Toast = {
	id: string
	type: 'success' | 'error' | 'warning' | 'info'
	title: string
	message: string
	duration?: number
}
