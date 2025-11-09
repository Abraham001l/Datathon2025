import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { apiService } from './api'
import { useToast } from './hooks/useToast'
import { ToastContainer } from './components/ToastContainer'
import { DashboardHeader } from './components/DashboardHeader'
import { UploadModal } from './components/UploadModal'
import { DocumentsTable } from './components/DocumentsTable'
import { UploadProgressIndicator, type FileUploadStatus } from './components/UploadProgressIndicator'
import type { Document } from './types'

export const Route = createFileRoute('/upload/')({
	component: UploadComponent,
})

function UploadComponent() {
	const [selectedFiles, setSelectedFiles] = useState<File[]>([])
	const [projectSpecs, setProjectSpecs] = useState<string>('')
	const [isSubmitting, setIsSubmitting] = useState(false)
	const [isUploading, setIsUploading] = useState(false)
	const [uploadingFiles, setUploadingFiles] = useState<FileUploadStatus[]>([])
	const [documents, setDocuments] = useState<Document[]>([])
	const [isLoadingDocuments, setIsLoadingDocuments] = useState(true)
	const [isModalOpen, setIsModalOpen] = useState(false)

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

	const handleUploadClick = () => {
		// Open modal immediately
		setIsModalOpen(true)
	}

	const handleModalClose = () => {
		if (!isUploading) {
			setIsModalOpen(false)
			// Clear files when modal is closed (unless uploading)
			if (!isUploading) {
				setSelectedFiles([])
				setProjectSpecs('')
			}
		}
	}

	const handleSubmitDocument = async () => {
		// Validate that we have files to upload
		if (selectedFiles.length === 0) {
			error('No Files Selected', 'Please select at least one file to upload')
			return
		}

		// Store files to upload before clearing
		const filesToUpload = [...selectedFiles]
		
		// Clear files immediately when upload starts
		setSelectedFiles([])
		setProjectSpecs('')
		setIsModalOpen(false)

		try {
			setIsSubmitting(true)
			setIsUploading(true)

			// Initialize upload status for all files
			const initialStatus: FileUploadStatus[] = filesToUpload.map((file) => ({
				filename: file.name,
				status: 'uploading',
			}))
			setUploadingFiles(initialStatus)

			// Show uploading toast
			const fileCount = filesToUpload.length
			info('Uploading...', `Uploading ${fileCount} file${fileCount > 1 ? 's' : ''}...`)

			// Upload all files in parallel
			const uploadPromises = filesToUpload.map(async (file) => {
				try {
					const uploadResponse = await apiService.uploadDocument(file)
					
					// Update status to success
					setUploadingFiles((prev) =>
						prev.map((f) =>
							f.filename === file.name
								? { filename: file.name, status: 'success' as const }
								: f
						)
					)

					return {
						filename: file.name,
						success: uploadResponse.status === 'success',
						error: uploadResponse.status !== 'success' ? uploadResponse.message : undefined,
					}
				} catch (err) {
					// Update status to error
					const errorMessage = err instanceof Error ? err.message : String(err)
					setUploadingFiles((prev) =>
						prev.map((f) =>
							f.filename === file.name
								? { filename: file.name, status: 'error' as const, error: errorMessage }
								: f
						)
					)

					return {
						filename: file.name,
						success: false,
						error: errorMessage,
					}
				}
			})

			// Wait for all uploads to complete
			const uploadResults = await Promise.all(uploadPromises)

			// Wait a bit for animations to complete before clearing
			setTimeout(() => {
				setIsUploading(false)
				setUploadingFiles([])
			}, 2000) // Wait 2 seconds to allow success animations to show

			// Refresh documents list after uploads
			await fetchDocuments()

			// Show success/error toasts
			const successful = uploadResults.filter((r) => r.success)
			const failed = uploadResults.filter((r) => !r.success)

			if (successful.length > 0) {
				if (successful.length === filesToUpload.length) {
					// All files uploaded successfully
					success(
						'Upload Successful',
						`Successfully uploaded ${successful.length} file${successful.length > 1 ? 's' : ''}`
					)
				} else {
					// Some files uploaded successfully
					success(
						'Partial Upload Success',
						`Successfully uploaded ${successful.length} of ${filesToUpload.length} files`
					)
				}
			}

			if (failed.length > 0) {
				const failedNames = failed.map((f) => f.filename).join(', ')
				error('Some Uploads Failed', `Failed to upload ${failed.length} file(s): ${failedNames}`)
			}
		} catch (err: unknown) {
			setIsUploading(false)
			setUploadingFiles([])
			console.error('Failed to upload documents:', err)
			const errorMsg = `Failed to upload documents: ${err instanceof Error ? err.message : String(err)}. Please try again.`
			error('Upload Failed', errorMsg)
		} finally {
			setIsSubmitting(false)
		}
	}

	const handleFileSelect = (files: File[]) => {
		setSelectedFiles(files)
	}

	return (
		<div className='h-screen flex flex-col bg-gray-50'>
			<ToastContainer toasts={toasts} onClose={removeToast} />
			<UploadProgressIndicator uploadingFiles={uploadingFiles} />
			<DashboardHeader />

			{/* Full width documents table - takes up remaining space */}
			<div className='flex-1 overflow-hidden'>
				<DocumentsTable 
					documents={documents} 
					isLoading={isLoadingDocuments}
					onUploadClick={handleUploadClick}
				/>
			</div>

			{/* Upload Modal */}
			<UploadModal
				isOpen={isModalOpen}
				selectedFiles={selectedFiles}
				projectSpecs={projectSpecs}
				isSubmitting={isSubmitting}
				isUploading={isUploading}
				onClose={handleModalClose}
				onFileSelect={handleFileSelect}
				onProjectSpecsChange={setProjectSpecs}
				onSubmit={handleSubmitDocument}
			/>
		</div>
	)
}
