import { useRef } from 'react'

interface FileUploadProps {
	selectedFiles: File[]
	onFileSelect: (files: File[]) => void
}

export function FileUpload({ selectedFiles, onFileSelect }: FileUploadProps) {
	const fileInputRef = useRef<HTMLInputElement>(null)

	const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
		const newFiles = Array.from(event.target.files || [])
		// Append new files to existing files, avoiding duplicates by name
		const existingFileNames = new Set(selectedFiles.map(f => f.name))
		const uniqueNewFiles = newFiles.filter(f => !existingFileNames.has(f.name))
		onFileSelect([...selectedFiles, ...uniqueNewFiles])
		// Reset the input so the same file can be selected again if needed
		if (fileInputRef.current) {
			fileInputRef.current.value = ''
		}
	}

	const handleRemoveFile = (indexToRemove: number) => {
		const updatedFiles = selectedFiles.filter((_, index) => index !== indexToRemove)
		onFileSelect(updatedFiles)
		// Reset the input so the same file can be selected again
		if (fileInputRef.current) {
			fileInputRef.current.value = ''
		}
	}

	const handleClearAll = () => {
		onFileSelect([])
		if (fileInputRef.current) {
			fileInputRef.current.value = ''
		}
	}

	return (
		<div>
			<button
				onClick={() => fileInputRef.current?.click()}
				className='w-full mt-2 px-4 py-2 border border-dashed border-gray-300 rounded-md text-sm text-gray-600 hover:bg-gray-50 transition-colors'
			>
				{selectedFiles.length === 0 ? 'Select Files' : 'Add More Files'}
			</button>
			
			<input
				ref={fileInputRef}
				type='file'
				multiple
				accept='.pdf,.doc,.docx,.txt,.md,.rtf,.odt,.csv,.xls,.xlsx,.ppt,.pptx,.html,.xml,.json'
				onChange={handleFileChange}
				className='hidden'
			/>

			{selectedFiles.length > 0 && (
				<div className='mt-3 space-y-2'>
					<div className='flex items-center justify-between'>
						<span className='text-sm font-medium text-gray-700'>
							{selectedFiles.length} file{selectedFiles.length > 1 ? 's' : ''} selected
						</span>
						<button
							onClick={handleClearAll}
							className='text-xs text-red-600 hover:text-red-800'
						>
							Clear all
						</button>
					</div>
					<div className='max-h-48 overflow-y-auto space-y-2'>
						{selectedFiles.map((file, index) => (
							<div
								key={`${file.name}-${index}`}
								className='p-3 bg-green-50 rounded-md border border-green-200'
							>
								<div className='flex items-center justify-between'>
									<div className='flex items-center space-x-2 flex-1 min-w-0'>
										<svg
											className='w-5 h-5 text-green-600 flex-shrink-0'
											fill='none'
											stroke='currentColor'
											viewBox='0 0 24 24'
										>
											<path
												strokeLinecap='round'
												strokeLinejoin='round'
												strokeWidth={2}
												d='M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z'
											/>
										</svg>
										<span className='text-sm font-medium text-green-800 truncate' title={file.name}>
											{file.name}
										</span>
									</div>
									<button
										onClick={() => handleRemoveFile(index)}
										className='text-green-600 hover:text-green-800 ml-2 flex-shrink-0'
										aria-label={`Remove ${file.name}`}
									>
										<svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
											<path
												strokeLinecap='round'
												strokeLinejoin='round'
												strokeWidth={2}
												d='M6 18L18 6M6 6l12 12'
											/>
										</svg>
									</button>
								</div>
								<p className='text-xs text-green-600 mt-1'>
									Size: {(file.size / 1024).toFixed(1)} KB
								</p>
							</div>
						))}
					</div>
				</div>
			)}
		</div>
	)
}
