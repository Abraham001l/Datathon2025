import { useState, useEffect } from 'react'

export type FileUploadStatus = {
	filename: string
	status: 'uploading' | 'success' | 'error'
	error?: string
}

interface UploadProgressIndicatorProps {
	uploadingFiles: FileUploadStatus[]
}

export function UploadProgressIndicator({ uploadingFiles }: UploadProgressIndicatorProps) {
	if (uploadingFiles.length === 0) {
		return null
	}

	return (
		<div className='fixed bottom-4 right-4 z-50 bg-white rounded-lg shadow-lg border border-gray-200 p-4 min-w-[300px] max-w-[400px] max-h-[500px] overflow-y-auto'>
			<div className='mb-2'>
				<h3 className='text-sm font-semibold text-gray-900'>Upload Progress</h3>
			</div>
			<div className='space-y-2'>
				{uploadingFiles.map((file, index) => (
					<FileUploadItem key={`${file.filename}-${index}`} file={file} />
				))}
			</div>
		</div>
	)
}

interface FileUploadItemProps {
	file: FileUploadStatus
}

function FileUploadItem({ file }: FileUploadItemProps) {
	const [checkmarkDrawn, setCheckmarkDrawn] = useState(false)
	const [shouldFadeOut, setShouldFadeOut] = useState(false)

	useEffect(() => {
		if (file.status === 'success') {
			// Small delay to ensure smooth animation
			const drawTimer = setTimeout(() => {
				setCheckmarkDrawn(true)
			}, 50)
			
			// Fade out after animation completes
			const fadeTimer = setTimeout(() => {
				setShouldFadeOut(true)
			}, 2000) // Show success for 2 seconds
			
			return () => {
				clearTimeout(drawTimer)
				clearTimeout(fadeTimer)
			}
		} else if (file.status === 'error') {
			// Error state - don't fade out automatically
			setCheckmarkDrawn(false)
		}
	}, [file.status])

	if (shouldFadeOut && file.status === 'success') {
		return null
	}

	return (
		<div
			className={`flex items-center space-x-3 p-2 rounded-md transition-all duration-500 ease-in-out ${
				file.status === 'success'
					? 'bg-green-50 border border-green-200'
					: file.status === 'error'
					? 'bg-red-50 border border-red-200'
					: 'bg-blue-50 border border-blue-200'
			} ${
				shouldFadeOut
					? 'opacity-0 transform scale-95 translate-x-2'
					: 'opacity-100 transform scale-100 translate-x-0'
			}`}
		>
			{/* Status Icon */}
			<div className='flex-shrink-0 relative'>
				{file.status === 'uploading' && (
					<svg
						className='animate-spin h-5 w-5 text-blue-600'
						xmlns='http://www.w3.org/2000/svg'
						fill='none'
						viewBox='0 0 24 24'
					>
						<circle
							className='opacity-25'
							cx='12'
							cy='12'
							r='10'
							stroke='currentColor'
							strokeWidth='4'
						></circle>
						<path
							className='opacity-75'
							fill='currentColor'
							d='M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z'
						></path>
					</svg>
				)}
				{file.status === 'success' && (
					<div className='relative h-5 w-5'>
						<svg
							className='h-5 w-5 text-green-600'
							fill='none'
							stroke='currentColor'
							viewBox='0 0 24 24'
						>
							<path
								strokeLinecap='round'
								strokeLinejoin='round'
								strokeWidth={3}
								d='M5 13l4 4L19 7'
								style={{
									strokeDasharray: 24,
									strokeDashoffset: checkmarkDrawn ? 0 : 24,
									transition: 'stroke-dashoffset 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
								}}
							/>
						</svg>
					</div>
				)}
				{file.status === 'error' && (
					<svg
						className='h-5 w-5 text-red-600'
						fill='none'
						stroke='currentColor'
						viewBox='0 0 24 24'
					>
						<path
							strokeLinecap='round'
							strokeLinejoin='round'
							strokeWidth={2}
							d='M6 18L18 6M6 6l12 12'
						/>
					</svg>
				)}
			</div>

			{/* File Info */}
			<div className='flex-1 min-w-0'>
				<p
					className={`text-sm font-medium truncate transition-colors duration-300 ${
						file.status === 'success'
							? 'text-green-800'
							: file.status === 'error'
							? 'text-red-800'
							: 'text-blue-800'
					}`}
					title={file.filename}
				>
					{file.filename}
				</p>
				{file.status === 'error' && file.error && (
					<p className='text-xs text-red-600 truncate mt-0.5' title={file.error}>
						{file.error}
					</p>
				)}
				{file.status === 'success' && (
					<p className='text-xs text-green-600 mt-0.5'>Uploaded successfully</p>
				)}
				{file.status === 'uploading' && (
					<p className='text-xs text-blue-600 mt-0.5'>Uploading...</p>
				)}
			</div>
		</div>
	)
}
