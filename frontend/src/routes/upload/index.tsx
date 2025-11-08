import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { apiService } from './api'
import { useToast } from './hooks/useToast'
import { ToastContainer } from './components/ToastContainer'
import { DashboardHeader } from './components/DashboardHeader'
import { SubmissionForm } from './components/SubmissionForm'
import { DocumentsTable } from './components/DocumentsTable'
import type { Document } from './types'

export const Route = createFileRoute('/upload/')({
	component: UploadComponent,
})

function UploadComponent() {
	const [selectedFile, setSelectedFile] = useState<string>('')
	const [selectedFileObject, setSelectedFileObject] = useState<File | null>(null)
	const [projectSpecs, setProjectSpecs] = useState<string>('')
	const [isSubmitting, setIsSubmitting] = useState(false)
	const [isUploading, setIsUploading] = useState(false)
	const [documents, setDocuments] = useState<Document[]>([])
	const [isLoadingDocuments, setIsLoadingDocuments] = useState(true)

	const { toasts, removeToast, success, error } = useToast()

	// Fetch documents on component mount
	useEffect(() => {
		const fetchDocuments = async () => {
			try {
				setIsLoadingDocuments(true)
				const response = await apiService.getDocuments(100) // Fetch up to 100 documents
				setDocuments(response.files)
			} catch (err) {
				console.error('Failed to fetch documents:', err)
				error('Failed to Load Documents', 'Could not fetch documents from the database')
			} finally {
				setIsLoadingDocuments(false)
			}
		}

		fetchDocuments()
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [])

	const handleSubmitDocument = async () => {
		if ((!selectedFile && !selectedFileObject) || !projectSpecs.trim()) {
			const errorMsg = 'Please select a file and provide project specifications'
			error('Validation Failed', errorMsg)
			return
		}

		try {
			setIsSubmitting(true)

			let filepath = selectedFile

			// If we have a file object, upload it first
			if (selectedFileObject) {
				setIsUploading(true)

				const uploadResponse = await apiService.uploadDocument(selectedFileObject)

				if (uploadResponse.status !== 'success') {
					throw new Error(`File upload failed: ${uploadResponse.message || 'Unknown error'}`)
				}
				filepath = uploadResponse.filepath
				setIsUploading(false)
			}

			const response = await apiService.submitDocument(filepath, projectSpecs, '')

			if (response.status === 'success') {
				const successMsg = `Document submitted successfully! Submission ID: ${response.submission_id}`
				success('Document Submitted', successMsg)

				// Reset form
				setSelectedFile('')
				setSelectedFileObject(null)
				setProjectSpecs('')
			} else {
				throw new Error(`Submission failed: ${response.message || 'Unknown error'}`)
			}
		} catch (err: unknown) {
			console.error('Failed to submit document:', err)
			const errorMsg = `Failed to submit document: ${err instanceof Error ? err.message : String(err)}. Please try again.`
			error('Submission Failed', errorMsg)
		} finally {
			setIsSubmitting(false)
			setIsUploading(false)
		}
	}

	const handleFileSelect = (file: File | null) => {
		if (file) {
			setSelectedFileObject(file)
			setSelectedFile('') // Clear any pre-selected file
		} else {
			setSelectedFileObject(null)
		}
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

					{/* Documents Table */}
					<div className='lg:col-span-2'>
						<DocumentsTable documents={documents} isLoading={isLoadingDocuments} />
					</div>
				</div>
			</div>

			{/* TODO: Implement flag details modal */}
		</div>
	)
}
