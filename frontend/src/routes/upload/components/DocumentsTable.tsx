import { motion, AnimatePresence } from 'motion/react'
import type { Document } from '../types'

interface DocumentsTableProps {
	documents: Document[]
	isLoading?: boolean
	onUploadClick?: () => void
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

function ClassifiedBadge({ classified }: { classified: string }) {
	const classifiedConfig: Record<string, { bg: string; text: string }> = {
		unclassified: { bg: 'bg-gray-100', text: 'text-gray-800' },
		public: { bg: 'bg-green-100', text: 'text-green-800' },
		confidential: { bg: 'bg-yellow-100', text: 'text-yellow-800' },
		secret: { bg: 'bg-orange-100', text: 'text-orange-800' },
		topsecret: { bg: 'bg-red-100', text: 'text-red-800' },
	}

	const config = classifiedConfig[classified.toLowerCase()] || { bg: 'bg-gray-100', text: 'text-gray-800' }

	return (
		<span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
			{classified.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
		</span>
	)
}

export function DocumentsTable({ documents, isLoading, onUploadClick }: DocumentsTableProps) {
	if (isLoading) {
		return (
			<div className='h-full w-full bg-white'>
				<div className='flex items-center justify-between p-4 border-b border-gray-200'>
					<h2 className='text-lg font-semibold text-gray-900'>Documents in Database</h2>
					{onUploadClick && (
						<button
							onClick={onUploadClick}
							className='flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium'
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
									d='M12 4v16m8-8H4'
								/>
							</svg>
							Upload
						</button>
					)}
				</div>
				<div className='text-center py-8 text-gray-500'>
					Loading documents...
				</div>
			</div>
		)
	}

	return (
		<div className='h-full w-full bg-white flex flex-col'>
			<div className='flex items-center justify-between p-4 border-b border-gray-200 flex-shrink-0'>
				<h2 className='text-lg font-semibold text-gray-900'>Documents in Database</h2>
				{onUploadClick && (
					<button
						onClick={onUploadClick}
						className='flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium'
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
								d='M12 4v16m8-8H4'
							/>
						</svg>
						Upload
					</button>
				)}
			</div>

			<div className='flex-1 overflow-auto'>
				<table className='w-full'>
					<thead className='bg-gray-50 sticky top-0 z-10'>
						<tr>
							<th className='px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
								Upload Date
							</th>
							<th className='px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
								Filename
							</th>
							<th className='px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
								Size
							</th>
							<th className='px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
								Type
							</th>
							<th className='px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
								Status
							</th>
							<th className='px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
								Classified
							</th>
						</tr>
					</thead>
					<tbody className='divide-y divide-gray-200'>
						<AnimatePresence mode='popLayout'>
							{documents.length === 0 ? (
								<tr>
									<td
										colSpan={6}
										className='px-4 py-8 text-center text-gray-500'
									>
										No documents found in the database.
									</td>
								</tr>
							) : (
								documents.map((doc, index) => (
									<motion.tr
										key={doc.file_id}
										initial={{ opacity: 0, y: 10 }}
										animate={{ opacity: 1, y: 0 }}
										exit={{ opacity: 0, x: -20 }}
										transition={{
											duration: 0.2,
											delay: index * 0.03,
										}}
										className='hover:bg-gray-50'
									>
										<td className='px-4 py-4 text-sm text-gray-500'>
											{doc.upload_date
												? new Date(doc.upload_date).toLocaleDateString()
												: 'N/A'}
										</td>
										<td className='px-4 py-4 text-sm text-gray-900'>
											<div className='font-medium'>{doc.filename || 'Unknown'}</div>
										</td>
										<td className='px-4 py-4 text-sm text-gray-500'>
											{doc.length !== undefined
												? `${(doc.length / 1024).toFixed(2)} KB`
												: 'N/A'}
										</td>
										<td className='px-4 py-4 text-sm text-gray-500'>
											{doc.content_type || 'N/A'}
										</td>
										<td className='px-4 py-4 text-sm'>
											{doc.metadata?.status ? (
												<StatusBadge status={doc.metadata.status} />
											) : (
												<span className='text-gray-400'>N/A</span>
											)}
										</td>
										<td className='px-4 py-4 text-sm'>
											{doc.metadata?.ai_classified_sensitivity ? (
												<ClassifiedBadge classified={doc.metadata.ai_classified_sensitivity} />
											) : (
												<span className='text-gray-400'>N/A</span>
											)}
										</td>
									</motion.tr>
								))
							)}
						</AnimatePresence>
					</tbody>
				</table>
			</div>
		</div>
	)
}

