import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'motion/react'
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
	const [isTableCollapsed, setIsTableCollapsed] = useState(false)
	const [isMenuOpen, setIsMenuOpen] = useState(false)
	const menuRef = useRef<HTMLDivElement>(null)

	const { toasts, removeToast, success, error, info } = useToast()

	// Close menu when clicking outside
	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
				setIsMenuOpen(false)
			}
		}

		if (isMenuOpen) {
			document.addEventListener('mousedown', handleClickOutside)
			return () => {
				document.removeEventListener('mousedown', handleClickOutside)
			}
		}
	}, [isMenuOpen])

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

			// Upload all files in parallel - create all promises immediately
			// This ensures all requests are sent concurrently without waiting
			const uploadPromises = filesToUpload.map((file) => {
				// Start the upload immediately and handle response/errors
				const uploadPromise = apiService.uploadDocument(file)
					.then((uploadResponse) => {
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
					})
					.catch((err) => {
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
					})
				
				// Return the promise immediately (all requests start in parallel)
				return uploadPromise
			})

			// Wait for all uploads to complete (all requests are already in flight)
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
				{/* Breadcrumb */}
				<motion.div
					className='mb-4'
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					transition={{ duration: 0.3 }}
				>
					<nav className='flex items-center text-sm text-gray-600'>
						<span className='text-gray-900'>Home</span>
						<svg
							className='w-4 h-4 mx-2 text-gray-500'
							fill='none'
							stroke='currentColor'
							viewBox='0 0 24 24'
						>
							<path
								strokeLinecap='round'
								strokeLinejoin='round'
								strokeWidth={2}
								d='M9 5l7 7-7 7'
							/>
						</svg>
						<span className='text-gray-900'>Upload</span>
					</nav>
				</motion.div>

				{/* Header */}
				<motion.div
					className='mb-6'
					initial={{ opacity: 0, y: -20 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.4, delay: 0.1 }}
				>
					<h1 className='text-3xl font-bold text-gray-900'>Upload Documents</h1>
					<p className='mt-1 text-sm text-gray-600'>Upload and manage your documents</p>
				</motion.div>

				{/* Filter and Search Bar */}
				<motion.div
					className='mb-6 flex items-center gap-4'
					initial={{ opacity: 0, y: -10 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.3, delay: 0.2 }}
				>
					{/* Filter Button */}
					<button className='flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-md transition-colors'>
						<svg
							className='w-5 h-5 text-gray-600'
							fill='none'
							stroke='currentColor'
							viewBox='0 0 24 24'
						>
							<path
								strokeLinecap='round'
								strokeLinejoin='round'
								strokeWidth={2}
								d='M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z'
							/>
						</svg>
						<span>Filter</span>
					</button>

					{/* Search Input */}
					<div className='flex-1 relative'>
						<div className='absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none'>
							<svg
								className='w-5 h-5 text-gray-400'
								fill='none'
								stroke='currentColor'
								viewBox='0 0 24 24'
							>
								<path
									strokeLinecap='round'
									strokeLinejoin='round'
									strokeWidth={2}
									d='M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z'
								/>
							</svg>
						</div>
						<input
							type='text'
							placeholder='Search document names'
							className='w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md text-sm text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'
						/>
					</div>
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
							<div className='flex items-center gap-2 flex-1'>
								<button
									onClick={() => setIsTableCollapsed(!isTableCollapsed)}
									className='text-gray-500 hover:text-gray-700 transition-colors'
								>
									<svg
										className={`w-5 h-5 transition-transform ${isTableCollapsed ? 'rotate-0' : 'rotate-90'}`}
										fill='none'
										stroke='currentColor'
										viewBox='0 0 24 24'
									>
										<path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M9 5l7 7-7 7' />
									</svg>
								</button>
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
							</div>
							<div className='flex items-center gap-2'>
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
								<div className='relative' ref={menuRef}>
									<button
										className='p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors'
										onClick={() => setIsMenuOpen(!isMenuOpen)}
										title='More options'
									>
										<svg
											className='w-5 h-5'
											fill='none'
											stroke='currentColor'
											viewBox='0 0 24 24'
										>
											<path
												strokeLinecap='round'
												strokeLinejoin='round'
												strokeWidth={2}
												d='M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z'
											/>
										</svg>
									</button>
									<AnimatePresence>
										{isMenuOpen && (
											<motion.div
												initial={{ opacity: 0, y: -10 }}
												animate={{ opacity: 1, y: 0 }}
												exit={{ opacity: 0, y: -10 }}
												className='absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg z-10 border border-gray-200'
											>
												<div className='py-1'>
													<button
														className='block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100'
														onClick={() => setIsMenuOpen(false)}
													>
														Export Selected
													</button>
													<button
														className='block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100'
														onClick={() => setIsMenuOpen(false)}
													>
														Delete Selected
													</button>
													<button
														className='block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100'
														onClick={() => setIsMenuOpen(false)}
													>
														Refresh
													</button>
												</div>
											</motion.div>
										)}
									</AnimatePresence>
								</div>
							</div>
						</div>
					</div>

					<AnimatePresence>
						{!isTableCollapsed && (
							<motion.div
								initial={{ height: 0, opacity: 0 }}
								animate={{ height: 'auto', opacity: 1 }}
								exit={{ height: 0, opacity: 0 }}
								transition={{ duration: 0.3 }}
								className='overflow-hidden'
							>
								<div className='overflow-x-auto'>
									<DocumentsTable 
										documents={documents} 
										isLoading={isLoadingDocuments}
									/>
								</div>
							</motion.div>
						)}
					</AnimatePresence>
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
