import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { apiService } from './api'
import { useToast } from './hooks/useToast'
import { ToastContainer } from './components/ToastContainer'
import { DashboardHeader } from './components/DashboardHeader'
import { SubmissionForm } from './components/SubmissionForm'

export const Route = createFileRoute('/upload/')({
	component: UploadComponent,
})

function UploadComponent() {
	const [selectedFile, setSelectedFile] = useState<string>('')
	const [selectedFileObject, setSelectedFileObject] = useState<File | null>(null)
	const [projectSpecs, setProjectSpecs] = useState<string>('')
	const [isSubmitting, setIsSubmitting] = useState(false)
	const [isUploading, setIsUploading] = useState(false)

	const { toasts, removeToast, success, error } = useToast()

	const handleSubmitDocument = async () => {
		console.log('🚀 handleSubmitDocument called')
		console.log('State check:', {
			selectedFile,
			selectedFileObject: selectedFileObject?.name,
			projectSpecs: projectSpecs?.substring(0, 50) + '...',
			isSubmitting,
			isUploading,
		})

		if ((!selectedFile && !selectedFileObject) || !projectSpecs.trim()) {
			const errorMsg = 'Please select a file and provide project specifications'
			console.log('❌ Validation failed:', errorMsg)
			error('Validation Failed', errorMsg)
			return
		}

		try {
			setIsSubmitting(true)
			console.log('📤 Starting submission process...')

			let filepath = selectedFile

			// If we have a file object, upload it first
			if (selectedFileObject) {
				console.log('📁 Uploading file:', selectedFileObject.name)
				setIsUploading(true)

				const uploadResponse = await apiService.uploadDocument(selectedFileObject)
				console.log('📤 Upload response:', uploadResponse)

				if (uploadResponse.status !== 'success') {
					throw new Error(`File upload failed: ${uploadResponse.message || 'Unknown error'}`)
				}
				filepath = uploadResponse.filepath
				console.log('✅ File uploaded to:', filepath)
				setIsUploading(false)
			}

			console.log('📋 Submitting document for review...')
			const response = await apiService.submitDocument(filepath, projectSpecs, '')
			console.log('📋 Submit response:', response)

			if (response.status === 'success') {
				const successMsg = `Document submitted successfully! Submission ID: ${response.submission_id}`
				console.log('🎉 Success:', successMsg)
				success('Document Submitted', successMsg)

				// Reset form
				setSelectedFile('')
				setSelectedFileObject(null)
				setProjectSpecs('')
			} else {
				throw new Error(`Submission failed: ${response.message || 'Unknown error'}`)
			}
		} catch (err: unknown) {
			console.error('❌ Failed to submit document:', err)
			const errorMsg = `Failed to submit document: ${err instanceof Error ? err.message : String(err)}. Please try again.`
			error('Submission Failed', errorMsg)
		} finally {
			setIsSubmitting(false)
			setIsUploading(false)
			console.log('✅ Submission process completed')
		}
	}

	const handleFileSelect = (file: File | null) => {
		if (file) {
			setSelectedFileObject(file)
			setSelectedFile('') // Clear any pre-selected file
			console.log('✅ File state updated:', file.name)
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

					{/* Submissions Queue */}
					<div className='lg:col-span-2'>
						{/* TODO: Implement submissions table */}
						<div className='bg-white dark:bg-gray-800 rounded-lg shadow p-6'>
							<h2 className='text-xl font-semibold mb-4'>Submissions Queue</h2>
							<p className='text-gray-500 dark:text-gray-400'>TODO: Display submissions list here</p>
						</div>
					</div>
				</div>
			</div>

			{/* TODO: Implement flag details modal */}
		</div>
	)
}
