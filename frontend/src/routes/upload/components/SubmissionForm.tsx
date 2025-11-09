import { FileUpload } from './FileUpload'

interface SubmissionFormProps {
	selectedFiles: File[]
	projectSpecs: string
	isSubmitting: boolean
	isUploading: boolean
	onFileSelect: (files: File[]) => void
	onProjectSpecsChange: (value: string) => void
	onSubmit: () => void
}

export function SubmissionForm({
	selectedFiles,
	projectSpecs,
	isSubmitting,
	isUploading,
	onFileSelect,
	onProjectSpecsChange,
	onSubmit,
}: SubmissionFormProps) {
	const isDisabled =
		isSubmitting ||
		isUploading ||
		selectedFiles.length === 0

	return (
		<div className='bg-white rounded-lg shadow-sm border border-gray-200'>
			<div className='p-4 border-b border-gray-200'>
				<h2 className='text-lg font-semibold text-gray-900'>Upload Document</h2>
			</div>
			<div className='p-4 space-y-4'>
				{/* File Selection */}
				<FileUpload selectedFiles={selectedFiles} onFileSelect={onFileSelect} />

				{/* Project Specifications (Optional) */}
				<div>
					<label className='block text-sm font-medium text-gray-700 mb-2'>
						Project Specifications (Optional)
					</label>
					<textarea
						value={projectSpecs}
						onChange={(e) => onProjectSpecsChange(e.target.value)}
						placeholder='Describe the project context and any relevant details...'
						rows={4}
						className='w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900'
					/>
				</div>

				{/* Submit Button */}
				<button
					onClick={onSubmit}
					disabled={isDisabled}
					className='w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white px-4 py-2 rounded-md text-sm font-medium transition-colors'
				>
					{isUploading 
						? `Uploading ${selectedFiles.length} file${selectedFiles.length > 1 ? 's' : ''}...` 
						: isSubmitting 
						? 'Submitting...' 
						: `Upload ${selectedFiles.length > 0 ? `${selectedFiles.length} file${selectedFiles.length > 1 ? 's' : ''}` : 'Document'}`}
				</button>
			</div>
		</div>
	)
}
