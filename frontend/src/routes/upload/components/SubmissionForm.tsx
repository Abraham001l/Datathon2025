import { FileUpload } from './FileUpload'

interface SubmissionFormProps {
	selectedFile: string
	selectedFileObject: File | null
	projectSpecs: string
	isSubmitting: boolean
	isUploading: boolean
	onFileSelect: (file: File | null) => void
	onProjectSpecsChange: (value: string) => void
	onSubmit: () => void
}

export function SubmissionForm({
	selectedFile,
	selectedFileObject,
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
		(!selectedFile && !selectedFileObject) ||
		!projectSpecs.trim()

	return (
		<div className='bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700'>
			<div className='p-4 border-b border-gray-200 dark:border-gray-700'>
				<h2 className='text-lg font-semibold text-gray-900 dark:text-white'>Submit Document</h2>
			</div>
			<div className='p-4 space-y-4'>
				{/* File Selection */}
				<FileUpload selectedFile={selectedFileObject} onFileSelect={onFileSelect} />

				{/* Project Specifications */}
				<div>
					<label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
						Project Specifications
					</label>
					<textarea
						value={projectSpecs}
						onChange={(e) => onProjectSpecsChange(e.target.value)}
						placeholder='Describe the project context and any relevant details...'
						rows={4}
						className='w-full rounded-md border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white'
					/>
				</div>

				{/* Submit Button */}
				<button
					onClick={onSubmit}
					disabled={isDisabled}
					className='w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white px-4 py-2 rounded-md text-sm font-medium transition-colors'
				>
					{isUploading ? 'Uploading...' : isSubmitting ? 'Submitting...' : 'Submit for Review'}
				</button>
			</div>
		</div>
	)
}
