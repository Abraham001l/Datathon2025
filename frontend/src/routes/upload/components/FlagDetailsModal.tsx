import type { SubmissionWithFlags } from '../types'

interface FlagDetailsModalProps {
	submission: SubmissionWithFlags
	onClose: () => void
}

export function FlagDetailsModal({ submission, onClose }: FlagDetailsModalProps) {
	return (
		<div className='fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50'>
			<div className='bg-white dark:bg-gray-800 rounded-lg max-w-4xl max-h-[80vh] overflow-y-auto m-4'>
				<div className='p-6'>
					<div className='flex justify-between items-center mb-4'>
						<h3 className='text-lg font-semibold text-gray-900 dark:text-white'>
							Flag Details - {submission.filename}
						</h3>
						<button
							onClick={onClose}
							className='text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
						>
							✕
						</button>
					</div>

					{submission.notes && (
						<div className='mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-md'>
							<h4 className='font-medium text-gray-900 dark:text-white mb-1'>Reviewer Notes:</h4>
							<p className='text-sm text-gray-700 dark:text-gray-300'>{submission.notes}</p>
						</div>
					)}

					<div className='space-y-4'>
						<h4 className='font-medium text-gray-900 dark:text-white'>
							Verified Flags ({submission.verifiedFlags?.length || 0})
						</h4>
						{submission.verifiedFlags?.map((flag, index) => (
							<div
								key={index}
								className='border border-red-200 dark:border-red-800 rounded-md p-3'
							>
								<div className='flex justify-between items-start mb-2'>
									<span className='text-sm font-medium text-red-800 dark:text-red-300'>
										{flag.clearance} - {flag.category}
									</span>
									<span className='text-xs text-gray-500 dark:text-gray-400'>
										Page {flag.page}, Row {flag.row}
									</span>
								</div>
								{flag.content && (
									<p className='text-sm text-gray-700 dark:text-gray-300 mb-1'>{flag.content}</p>
								)}
								{flag.reason && (
									<p className='text-xs text-gray-500 dark:text-gray-400 italic'>{flag.reason}</p>
								)}
							</div>
						))}
					</div>
				</div>
			</div>
		</div>
	)
}
