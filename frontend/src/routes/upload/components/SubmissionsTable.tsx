import type { Submission } from '../types'
import { StatusBadge } from './StatusBadge'
import { ProgressIndicator } from './ProgressIndicator'

interface SubmissionsTableProps {
	submissions: Submission[]
	onViewFlags: (submission: Submission) => void
}

export function SubmissionsTable({ submissions, onViewFlags }: SubmissionsTableProps) {
	return (
		<div className='bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700'>
			<div className='p-4 border-b border-gray-200 dark:border-gray-700'>
				<h2 className='text-lg font-semibold text-gray-900 dark:text-white'>My Submissions</h2>
			</div>

			<div className='overflow-x-auto'>
				<table className='w-full'>
					<thead className='bg-gray-50 dark:bg-gray-700'>
						<tr>
							<th className='px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider'>
								Document
							</th>
							<th className='px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider'>
								Status
							</th>
							<th className='px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider'>
								Clearance Level
							</th>
							<th className='px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider'>
								Submitted
							</th>
							<th className='px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider'>
								Progress
							</th>
							<th className='px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider'>
								Actions
							</th>
						</tr>
					</thead>
					<tbody className='divide-y divide-gray-200 dark:divide-gray-600'>
						{submissions.length === 0 ? (
							<tr>
								<td
									colSpan={6}
									className='px-4 py-8 text-center text-gray-500 dark:text-gray-400'
								>
									No submissions yet. Submit your first document above.
								</td>
							</tr>
						) : (
							submissions.map((submission) => (
								<tr key={submission.id} className='hover:bg-gray-50 dark:hover:bg-gray-700'>
									<td className='px-4 py-4 text-sm text-gray-900 dark:text-white'>
										<div>
											<div className='font-medium'>{submission.filename}</div>
											<div className='text-gray-500 dark:text-gray-400 text-xs'>
												{submission.projectSpecs || 'No specifications'}
											</div>
										</div>
									</td>
									<td className='px-4 py-4'>
										<StatusBadge status={submission.status} />
									</td>
									<td className='px-4 py-4 text-sm text-gray-500 dark:text-gray-400'>
										{submission.clearance || 'N/A'}
									</td>
									<td className='px-4 py-4 text-sm text-gray-500 dark:text-gray-400'>
										{new Date(submission.submittedAt).toLocaleDateString()}
									</td>
									<td className='px-4 py-4 text-sm'>
										<ProgressIndicator status={submission.status} />
									</td>
									<td className='px-4 py-4 text-sm space-y-1'>
										<button className='hover:cursor-pointer block w-full text-left text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 text-xs'>
											🚩 Add Flags
										</button>
										{submission.status === 'rejected' && (
											<button
												onClick={() => onViewFlags(submission)}
												className='block w-full text-left text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-xs'
											>
												🚩 View Flags
											</button>
										)}
										{submission.status === 'accepted' && (
											<span className='text-green-600 dark:text-green-400 text-xs'>
												✓ Ready for download
											</span>
										)}
										{submission.status === 'in_review' && (
											<span className='text-yellow-600 dark:text-yellow-400 text-xs'>
												⏳ Under review
											</span>
										)}
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
