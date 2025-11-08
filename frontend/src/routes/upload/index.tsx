import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import type { Submission, SubmissionWithFlags, Document } from './types'
import { apiService } from './api'
import { useToast } from './hooks/useToast'
import { ToastContainer } from './components/ToastContainer'
import { LoadingSpinner } from './components/LoadingSpinner'
import { DashboardHeader } from './components/DashboardHeader'
import { SubmissionForm } from './components/SubmissionForm'
import { SubmissionsTable } from './components/SubmissionsTable'
import { FlagDetailsModal } from './components/FlagDetailsModal'

export const Route = createFileRoute('/upload/')({
	component: UploadComponent,
})

function UploadComponent() {
	const [submissions, setSubmissions] = useState<Submission[]>([])
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	const [documents, setDocuments] = useState<Document[]>([])
	const [selectedFile, setSelectedFile] = useState<string>('')
	const [selectedFileObject, setSelectedFileObject] = useState<File | null>(null)
	const [projectSpecs, setProjectSpecs] = useState<string>('')
	const [isSubmitting, setIsSubmitting] = useState(false)
	const [isUploading, setIsUploading] = useState(false)
	const [isLoading, setIsLoading] = useState(true)
	const [selectedSubmission, setSelectedSubmission] = useState<SubmissionWithFlags | null>(null)
	const [showFlagDetails, setShowFlagDetails] = useState(false)

	const { toasts, removeToast, success, error } = useToast()

	// Load initial data and set up auto-refresh
	useEffect(() => {
		setIsLoading(true)
		loadData()

		// Auto-refresh every 5 seconds to show real-time status updates
		const interval = setInterval(() => {
			loadData()
		}, 5000)

		return () => clearInterval(interval)
	}, [])

	const loadData = async () => {
		console.log('🔄 Loading data...')
		try {
			const [submissionsResponse, documentsResponse] = await Promise.all([
				apiService.getSubmissions(),
				apiService.getDocuments(),
			])

			console.log('📊 Data loaded:', {
				submissions: submissionsResponse?.length || 0,
				documents: documentsResponse?.length || 0,
			})

			setSubmissions(submissionsResponse || [])
			// TODO: Use documentsResponse when implementing document selection
			setDocuments(documentsResponse || [])
		} catch (error) {
			console.error('❌ Failed to load data:', error)
		} finally {
			setIsLoading(false)
		}
	}

	const handleSubmitDocument = async () => {
		console.log('🚀 handleSubmitDocument called')
		console.log('State check:', {
			selectedFile,
			selectedFileObject: selectedFileObject?.name,
			projectSpecs: projectSpecs?.substring(0, 50) + '...',
			isSubmitting,
			isUploading,
		})

		if ((!selectedFile && !selectedFileObject) || !projectSpecs.trim()) {
			const errorMsg = 'Please select a file and provide project specifications'
			console.log('❌ Validation failed:', errorMsg)
			error('Validation Failed', errorMsg)
			return
		}

		try {
			setIsSubmitting(true)
			console.log('📤 Starting submission process...')

			let filepath = selectedFile

			// If we have a file object, upload it first
			if (selectedFileObject) {
				console.log('📁 Uploading file:', selectedFileObject.name)
				setIsUploading(true)

				const uploadResponse = await apiService.uploadDocument(selectedFileObject)
				console.log('📤 Upload response:', uploadResponse)

				if (uploadResponse.status !== 'success') {
					throw new Error(`File upload failed: ${uploadResponse.message || 'Unknown error'}`)
				}
				filepath = uploadResponse.filepath
				console.log('✅ File uploaded to:', filepath)
				setIsUploading(false)
			}

			console.log('📋 Submitting document for review...')
			const response = await apiService.submitDocument(filepath, projectSpecs, '')
			console.log('📋 Submit response:', response)

			if (response.status === 'success') {
				const successMsg = `Document submitted successfully! Submission ID: ${response.submission_id}`
				console.log('🎉 Success:', successMsg)
				success('Document Submitted', successMsg)

				// Reset form
				setSelectedFile('')
				setSelectedFileObject(null)
				setProjectSpecs('')

				console.log('🔄 Refreshing data...')
				await loadData() // Refresh submissions list
			} else {
				throw new Error(`Submission failed: ${response.message || 'Unknown error'}`)
			}
		} catch (err: unknown) {
			console.error('❌ Failed to submit document:', err)
			const errorMsg = `Failed to submit document: ${err instanceof Error ? err.message : String(err)}. Please try again.`
			error('Submission Failed', errorMsg)
		} finally {
			setIsSubmitting(false)
			setIsUploading(false)
			console.log('✅ Submission process completed')
		}
	}

	const handleFileSelect = (file: File | null) => {
		if (file) {
			setSelectedFileObject(file)
			setSelectedFile('') // Clear any pre-selected file
			console.log('✅ File state updated:', file.name)
		} else {
			setSelectedFileObject(null)
		}
	}

	const viewSubmissionFlags = async (submission: Submission) => {
		try {
			const response = await apiService.getSubmissionFlags(submission.id)
			setSelectedSubmission({
				...submission,
				aiFlags: response.ai_flags,
				verifiedFlags: response.verified_flags,
				notes: response.reviewer_notes,
			})
			setShowFlagDetails(true)
		} catch (err) {
			console.error('Failed to load flags:', err)
			error('Failed to Load Flags', 'Failed to load flag details. Please try again.')
		}
	}

	if (isLoading) {
		return <LoadingSpinner />
	}

	return (
		<div className='min-h-screen bg-gray-50 dark:bg-gray-900'>
			<ToastContainer toasts={toasts} onClose={removeToast} />
			<DashboardHeader />

			<div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6'>
				<div className='grid grid-cols-1 lg:grid-cols-3 gap-6'>
					{/* Document Submission */}
					<div className='lg:col-span-1'>
						<SubmissionForm
							selectedFile={selectedFile}
							selectedFileObject={selectedFileObject}
							projectSpecs={projectSpecs}
							isSubmitting={isSubmitting}
							isUploading={isUploading}
							onFileSelect={handleFileSelect}
							onProjectSpecsChange={setProjectSpecs}
							onSubmit={handleSubmitDocument}
						/>
					</div>

					{/* Submissions Queue */}
					<div className='lg:col-span-2'>
						<SubmissionsTable submissions={submissions} onViewFlags={viewSubmissionFlags} />
					</div>
				</div>
			</div>

			{/* Flag Details Modal */}
			{showFlagDetails && selectedSubmission && (
				<FlagDetailsModal
					submission={selectedSubmission}
					onClose={() => setShowFlagDetails(false)}
				/>
			)}
		</div>
	)
}
