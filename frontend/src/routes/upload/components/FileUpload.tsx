import { useRef } from 'react'

interface FileUploadProps {
	selectedFile: File | null
	onFileSelect: (file: File | null) => void
}

export function FileUpload({ selectedFile, onFileSelect }: FileUploadProps) {
	const fileInputRef = useRef<HTMLInputElement>(null)

	const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0]
		onFileSelect(file || null)
	}

	return (
		<div>
			{selectedFile ? (
				<div className='mt-2 p-3 bg-green-50 dark:bg-green-900/20 rounded-md border border-green-200 dark:border-green-800'>
					<div className='flex items-center justify-between'>
						<div className='flex items-center space-x-2'>
							<svg
								className='w-5 h-5 text-green-600 dark:text-green-400'
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
							<span className='text-sm font-medium text-green-800 dark:text-green-300'>
								File Selected: {selectedFile.name}
							</span>
						</div>
						<button
							onClick={() => onFileSelect(null)}
							className='text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300'
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
					<p className='text-xs text-green-600 dark:text-green-400 mt-1'>
						Size: {(selectedFile.size / 1024).toFixed(1)} KB
					</p>
				</div>
			) : (
				<button
					onClick={() => fileInputRef.current?.click()}
					className='w-full mt-2 px-4 py-2 border border-dashed border-gray-300 dark:border-gray-600 rounded-md text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
				>
					Upload New File
				</button>
			)}
			<input
				ref={fileInputRef}
				type='file'
				accept='.pdf,.doc,.docx,.txt,.md,.rtf,.odt,.csv,.xls,.xlsx,.ppt,.pptx,.html,.xml,.json'
				onChange={handleFileChange}
				className='hidden'
			/>
		</div>
	)
}
