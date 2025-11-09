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

	if (isLoading) {
		return (
			<table className='w-full'>
				<thead className='bg-gray-50'>
					<tr>
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
						<td colSpan={6} className='px-4 py-8 text-center text-gray-500'>
							Loading documents...
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
				{documents.length === 0 ? (
					<tr>
						<td colSpan={6} className='px-4 py-8 text-center text-gray-500'>
							No documents found in the database.
						</td>
					</tr>
				) : (
					documents.map((doc) => (
						<tr
							key={doc.file_id}
							className='hover:bg-blue-50 transition-colors'
						>
							<td className='px-4 py-4 text-sm font-medium text-gray-900'>
								{doc.filename || 'Unknown'}
							</td>
							<td className='px-4 py-4 text-sm'>
								{doc.metadata?.status ? (
									<StatusBadge status={doc.metadata.status} />
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
						</tr>
					))
				)}
			</tbody>
		</table>
	)
}

