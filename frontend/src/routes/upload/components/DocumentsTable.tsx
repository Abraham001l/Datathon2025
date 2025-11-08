import type { Document } from '../types'

interface DocumentsTableProps {
	documents: Document[]
	isLoading?: boolean
}

export function DocumentsTable({ documents, isLoading }: DocumentsTableProps) {
	if (isLoading) {
		return (
			<div className='bg-white dark:bg-gray-800 rounded-lg shadow p-6'>
				<h2 className='text-xl font-semibold mb-4'>Documents in Database</h2>
				<div className='text-center py-8 text-gray-500 dark:text-gray-400'>
					Loading documents...
				</div>
			</div>
		)
	}

	return (
		<div className='bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700'>
			<div className='p-4 border-b border-gray-200 dark:border-gray-700'>
				<h2 className='text-lg font-semibold text-gray-900 dark:text-white'>Documents in Database</h2>
			</div>

			<div className='overflow-x-auto'>
				<table className='w-full'>
					<thead className='bg-gray-50 dark:bg-gray-700'>
						<tr>
							<th className='px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider'>
								File ID
							</th>
							<th className='px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider'>
								Filename
							</th>
							<th className='px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider'>
								Upload Date
							</th>
							<th className='px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider'>
								Size
							</th>
							<th className='px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider'>
								Type
							</th>
						</tr>
					</thead>
					<tbody className='divide-y divide-gray-200 dark:divide-gray-600'>
						{documents.length === 0 ? (
							<tr>
								<td
									colSpan={5}
									className='px-4 py-8 text-center text-gray-500 dark:text-gray-400'
								>
									No documents found in the database.
								</td>
							</tr>
						) : (
							documents.map((doc) => (
								<tr key={doc.file_id} className='hover:bg-gray-50 dark:hover:bg-gray-700'>
									<td className='px-4 py-4 text-xs text-gray-900 dark:text-white font-mono'>
										{doc.file_id}
									</td>
									<td className='px-4 py-4 text-sm text-gray-900 dark:text-white'>
										<div className='font-medium'>{doc.filename || 'Unknown'}</div>
									</td>
									<td className='px-4 py-4 text-sm text-gray-500 dark:text-gray-400'>
										{doc.upload_date
											? new Date(doc.upload_date).toLocaleDateString()
											: 'N/A'}
									</td>
									<td className='px-4 py-4 text-sm text-gray-500 dark:text-gray-400'>
										{doc.length !== undefined
											? `${(doc.length / 1024).toFixed(2)} KB`
											: 'N/A'}
									</td>
									<td className='px-4 py-4 text-sm text-gray-500 dark:text-gray-400'>
										{doc.content_type || 'N/A'}
									</td>
								</tr>
							))
						)}
					</tbody>
				</table>
			</div>
		</div>
	)
}

