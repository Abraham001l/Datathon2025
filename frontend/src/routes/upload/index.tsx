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

	const { toasts, removeToast, success, error, info } = useToast()

	// Function to fetch documents
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

	// Fetch documents on component mount
	useEffect(() => {
		fetchDocuments()
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [])

	const handleSubmitDocument = async () => {
		// Validate that we have a file to upload
		if (!selectedFileObject) {
			error('No File Selected', 'Please select a file to upload')
			return
		}

		try {
			setIsSubmitting(true)
			setIsUploading(true)

			// Show uploading toast
			const filename = selectedFileObject.name
			info('Uploading...', `Uploading ${filename}...`)

			// Upload the document asynchronously
			const uploadResponse = await apiService.uploadDocument(selectedFileObject)

			if (uploadResponse.status !== 'success') {
				throw new Error(`File upload failed: ${uploadResponse.message || 'Unknown error'}`)
			}

			setIsUploading(false)

			// Refresh documents list after successful upload
			await fetchDocuments()

			// Show success toast with filename
			success('Upload Successful', `Upload of ${filename} successful`)

			// Reset form
			setSelectedFile('')
			setSelectedFileObject(null)
			setProjectSpecs('')

			// Submit document (placeholder for now - only if projectSpecs provided)
			if (projectSpecs.trim()) {
				try {
					const response = await apiService.submitDocument(uploadResponse.filepath, projectSpecs, '')
					if (response.status !== 'success') {
						console.warn('Document submission failed:', response.message)
					}
				} catch (submitErr) {
					// Don't show error for submission failure since upload was successful
					console.warn('Document submission failed:', submitErr)
				}
			}
		} catch (err: unknown) {
			setIsUploading(false)
			console.error('Failed to upload document:', err)
			const errorMsg = `Failed to upload document: ${err instanceof Error ? err.message : String(err)}. Please try again.`
			error('Upload Failed', errorMsg)
		} finally {
			setIsSubmitting(false)
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
