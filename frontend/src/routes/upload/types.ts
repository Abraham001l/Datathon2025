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
	id: string
	filename: string
	// Add other fields as needed
}

export type Flag = {
	clearance: string
	category: string
	page: number
	row: number
	content?: string
	reason?: string
}

export type SubmissionWithFlags = Submission & {
	aiFlags?: Flag[]
	verifiedFlags?: Flag[]
	notes?: string
}

export type Toast = {
	id: string
	type: 'success' | 'error' | 'warning' | 'info'
	title: string
	message: string
}
