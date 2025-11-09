import { motion, AnimatePresence } from 'motion/react'
import { useState } from 'react'
import type { Document } from '../types'

interface DocumentsTableProps {
	documents: Document[]
	isLoading?: boolean
}

function StatusBadge({ status }: { status: string }) {
	const statusConfig: Record<string, { bg: string; text: string }> = {
		pending_classification: { bg: 'bg-yellow-100', text: 'text-yellow-800' },
		classified: { bg: 'bg-blue-100', text: 'text-blue-800' },
		reviewed: { bg: 'bg-green-100', text: 'text-green-800' },
		rejected: { bg: 'bg-red-100', text: 'text-red-800' },
	}

	const config = statusConfig[status.toLowerCase()] || { bg: 'bg-gray-100', text: 'text-gray-800' }

	return (
		<span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
			{status.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
		</span>
	)
}

export function DocumentsTable({ documents, isLoading }: DocumentsTableProps) {
	const [selectedDocuments, setSelectedDocuments] = useState<Set<string>>(new Set())

	const formatFileSize = (bytes?: number): string => {
		if (!bytes) return 'N/A'
		if (bytes < 1024) return `${bytes} B`
		if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`
		return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
	}

	const formatDate = (dateString?: string): string => {
		if (!dateString) return 'N/A'
		try {
			return new Date(dateString).toLocaleString()
		} catch {
			return 'N/A'
		}
	}

	const handleSelectAll = (checked: boolean) => {
		if (checked) {
			setSelectedDocuments(new Set(documents.map(doc => doc.file_id)))
		} else {
			setSelectedDocuments(new Set())
		}
	}

	const handleSelectDocument = (fileId: string, checked: boolean) => {
		const newSelected = new Set(selectedDocuments)
		if (checked) {
			newSelected.add(fileId)
		} else {
			newSelected.delete(fileId)
		}
		setSelectedDocuments(newSelected)
	}

	const isAllSelected = documents.length > 0 && selectedDocuments.size === documents.length
	const isIndeterminate = selectedDocuments.size > 0 && selectedDocuments.size < documents.length

	if (isLoading) {
		return (
			<table className='w-full'>
				<thead className='bg-gray-50'>
					<tr>
						<th className='px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-12'>
							<input
								type='checkbox'
								className='rounded border-gray-300 text-blue-600 focus:ring-blue-500'
								disabled
							/>
						</th>
						<th className='px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
							Filename
						</th>
						<th className='px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
							Status
						</th>
						<th className='px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
							Upload Date
						</th>
						<th className='px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
							Size
						</th>
						<th className='px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
							Type
						</th>
						<th className='px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
							AI Sensitivity
						</th>
					</tr>
				</thead>
				<tbody>
					<tr>
						<td colSpan={7} className='px-4 py-8 text-center text-gray-500'>
							<motion.div
								className='flex flex-col items-center justify-center gap-3'
								initial={{ opacity: 0 }}
								animate={{ opacity: 1 }}
								transition={{ duration: 0.3 }}
							>
								<motion.div
									className='w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full'
									animate={{ rotate: 360 }}
									transition={{
										duration: 1,
										repeat: Infinity,
										ease: 'linear',
									}}
								/>
								<span>Loading documents...</span>
							</motion.div>
						</td>
					</tr>
				</tbody>
			</table>
		)
	}

	return (
		<table className='w-full'>
			<thead className='bg-gray-50'>
				<tr>
					<th className='px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-12'>
						<input
							type='checkbox'
							className='rounded border-gray-300 text-blue-600 focus:ring-blue-500'
							checked={isAllSelected}
							ref={(input) => {
								if (input) input.indeterminate = isIndeterminate
							}}
							onChange={(e) => handleSelectAll(e.target.checked)}
						/>
					</th>
					<th className='px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
						Filename
					</th>
					<th className='px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
						Status
					</th>
					<th className='px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
						Upload Date
					</th>
					<th className='px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
						Size
					</th>
					<th className='px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
						Type
					</th>
					<th className='px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
						AI Sensitivity
					</th>
				</tr>
			</thead>
			<tbody className='divide-y divide-gray-200'>
				<AnimatePresence mode='popLayout'>
					{documents.length === 0 ? (
						<motion.tr
							key='empty'
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							exit={{ opacity: 0 }}
						>
							<td colSpan={7} className='px-4 py-8 text-center text-gray-500'>
								No documents found in the database.
							</td>
						</motion.tr>
					) : (
						documents.map((doc, index) => (
							<motion.tr
								key={doc.file_id}
								initial={{ opacity: 0, y: 10, backgroundColor: 'rgb(255 255 255)' }}
								animate={{ opacity: 1, y: 0, backgroundColor: 'rgb(255 255 255)' }}
								exit={{ opacity: 0, x: -20 }}
								transition={{
									duration: 0.3,
									delay: index * 0.03,
									ease: 'easeOut',
								}}
								whileHover={{ 
									backgroundColor: 'rgb(239 246 255)',
									transition: { duration: 0.15, ease: 'easeOut' }
								}}
								className='cursor-default bg-white'
							>
								<td className='px-4 py-4'>
									<input
										type='checkbox'
										className='rounded border-gray-300 text-blue-600 focus:ring-blue-500'
										checked={selectedDocuments.has(doc.file_id)}
										onChange={(e) => {
											e.stopPropagation()
											handleSelectDocument(doc.file_id, e.target.checked)
										}}
										onClick={(e) => e.stopPropagation()}
									/>
								</td>
								<td className='px-4 py-4 text-sm font-medium text-gray-900'>
									{doc.filename || 'Unknown'}
								</td>
								<td className='px-4 py-4 text-sm'>
									{doc.metadata?.status ? (
										<motion.div
											initial={{ scale: 0.8, opacity: 0 }}
											animate={{ scale: 1, opacity: 1 }}
											transition={{ delay: index * 0.03 + 0.1 }}
										>
											<StatusBadge status={doc.metadata.status} />
										</motion.div>
									) : (
										<span className='text-gray-500'>N/A</span>
									)}
								</td>
								<td className='px-4 py-4 text-sm text-gray-500'>
									{formatDate(doc.upload_date)}
								</td>
								<td className='px-4 py-4 text-sm text-gray-500'>
									{formatFileSize(doc.length)}
								</td>
								<td className='px-4 py-4 text-sm text-gray-500'>
									{doc.content_type?.split('/')[1]?.toUpperCase() || doc.content_type || 'N/A'}
								</td>
								<td className='px-4 py-4 text-sm text-gray-500'>
									{doc.metadata?.ai_classified_sensitivity?.replace(/_/g, ' ') || 'N/A'}
								</td>
							</motion.tr>
						))
					)}
				</AnimatePresence>
			</tbody>
		</table>
	)
}

