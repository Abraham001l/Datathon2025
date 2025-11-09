import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { motion } from 'motion/react'
import { apiService } from './api'
import { useToast } from './hooks/useToast'
import { ToastContainer } from './components/ToastContainer'
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
		<motion.div
			className='min-h-screen bg-gray-50'
			initial={{ opacity: 0 }}
			animate={{ opacity: 1 }}
			transition={{ duration: 0.3 }}
		>
			<ToastContainer toasts={toasts} onClose={removeToast} />
			<UploadProgressIndicator uploadingFiles={uploadingFiles} />
			
			<div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6'>
				{/* Header */}
				<motion.div
					className='mb-6'
					initial={{ opacity: 0, y: -20 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.4, delay: 0.1 }}
				>
					<h1 className='text-3xl font-bold text-gray-900'>Documents in Database</h1>
					<p className='mt-1 text-sm text-gray-600'>Upload and manage your documents</p>
				</motion.div>

				{/* Documents Table Card */}
				<motion.div
					className='bg-white rounded-lg shadow-sm border border-gray-200'
					initial={{ opacity: 0, y: 20, scale: 0.98 }}
					animate={{ opacity: 1, y: 0, scale: 1 }}
					transition={{ duration: 0.4, delay: 0.2 }}
				>
					<div className='p-4 border-b border-gray-200'>
						<div className='flex items-center justify-between'>
							<motion.h2
								className='text-lg font-semibold text-gray-900'
								initial={{ opacity: 0 }}
								animate={{ opacity: 1 }}
								transition={{ duration: 0.3, delay: 0.3 }}
							>
								Documents
								<span className='ml-2 text-sm font-normal text-gray-500'>
									({documents.length} {documents.length === 1 ? 'document' : 'documents'})
								</span>
							</motion.h2>
							{!isLoadingDocuments && (
								<motion.button
									onClick={handleUploadClick}
									className='flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium'
									whileHover={{ scale: 1.05 }}
									whileTap={{ scale: 0.95 }}
									transition={{ duration: 0.2 }}
									initial={{ opacity: 0, scale: 0.9 }}
									animate={{ opacity: 1, scale: 1 }}
								>
									<svg
										className='w-4 h-4'
										fill='none'
										stroke='currentColor'
										viewBox='0 0 24 24'
									>
										<path
											strokeLinecap='round'
											strokeLinejoin='round'
											strokeWidth={2}
											d='M12 4v16m8-8H4'
										/>
									</svg>
									Upload
								</motion.button>
							)}
						</div>
					</div>

					<div className='overflow-x-auto'>
						<DocumentsTable 
							documents={documents} 
							isLoading={isLoadingDocuments}
						/>
					</div>
				</motion.div>
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
		</motion.div>
	)
}
