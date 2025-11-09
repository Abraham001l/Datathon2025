import { motion, AnimatePresence } from 'motion/react'
import { FileUpload } from './FileUpload'

interface UploadModalProps {
	isOpen: boolean
	selectedFiles: File[]
	projectSpecs: string
	isSubmitting: boolean
	isUploading: boolean
	onClose: () => void
	onFileSelect: (files: File[]) => void
	onProjectSpecsChange: (value: string) => void
	onSubmit: () => void
}

export function UploadModal({
	isOpen,
	selectedFiles,
	projectSpecs,
	isSubmitting,
	isUploading,
	onClose,
	onFileSelect,
	onProjectSpecsChange,
	onSubmit,
}: UploadModalProps) {
	const isDisabled = isSubmitting || isUploading || selectedFiles.length === 0

	return (
		<AnimatePresence>
			{isOpen && (
				<>
					{/* Backdrop */}
					<motion.div
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						onClick={onClose}
						className='fixed inset-0 bg-black/50 z-50'
					/>

					{/* Modal */}
					<div className='fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none'>
						<motion.div
							initial={{ opacity: 0, scale: 0.95, y: 20 }}
							animate={{ opacity: 1, scale: 1, y: 0 }}
							exit={{ opacity: 0, scale: 0.95, y: 20 }}
							transition={{ duration: 0.2 }}
							onClick={(e) => e.stopPropagation()}
							className='bg-white rounded-lg shadow-xl w-full max-w-2xl pointer-events-auto max-h-[90vh] flex flex-col'
						>
							{/* Header */}
							<div className='flex items-center justify-between p-6 border-b border-gray-200'>
								<h2 className='text-xl font-semibold text-gray-900'>Upload Documents</h2>
								<button
									onClick={onClose}
									disabled={isUploading}
									className='text-gray-400 hover:text-gray-600 transition-colors p-1 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed'
									aria-label='Close modal'
								>
									<svg className='w-5 h-5' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
										<path
											strokeLinecap='round'
											strokeLinejoin='round'
											strokeWidth={2}
											d='M6 18L18 6M6 6l12 12'
										/>
									</svg>
								</button>
							</div>

							{/* Content */}
							<div className='flex-1 overflow-y-auto p-6 space-y-4'>
								{/* File Selection */}
								<div>
									<label className='block text-sm font-medium text-gray-700 mb-2'>
										Files to Upload
									</label>
									<FileUpload selectedFiles={selectedFiles} onFileSelect={onFileSelect} />
								</div>

								{/* Project Specifications (Optional) */}
								<div>
									<label className='block text-sm font-medium text-gray-700 mb-2'>
										Context (Optional)
									</label>
									<textarea
										value={projectSpecs}
										onChange={(e) => onProjectSpecsChange(e.target.value)}
										placeholder='Describe the project context and any relevant details...'
										rows={4}
										disabled={isUploading}
										className='w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed'
									/>
								</div>
							</div>

							{/* Footer */}
							<div className='flex items-center justify-end gap-3 p-6 border-t border-gray-200'>
								<button
									onClick={onClose}
									disabled={isUploading}
									className='px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors'
								>
									Cancel
								</button>
								<button
									onClick={onSubmit}
									disabled={isDisabled}
									className='px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors'
								>
									{isUploading
										? `Uploading ${selectedFiles.length} file${selectedFiles.length > 1 ? 's' : ''}...`
										: isSubmitting
										? 'Submitting...'
										: `Upload ${selectedFiles.length > 0 ? `${selectedFiles.length} file${selectedFiles.length > 1 ? 's' : ''}` : 'Document'}`}
								</button>
							</div>
						</motion.div>
					</div>
				</>
			)}
		</AnimatePresence>
	)
}
