interface ProgressIndicatorProps {
	status: string
}

export function ProgressIndicator({ status }: ProgressIndicatorProps) {
	const progressConfig = {
		in_queue: { width: '25%', color: 'bg-blue-500', text: 'Queued' },
		in_review: { width: '50%', color: 'bg-yellow-500', text: 'Reviewing' },
		accepted: { width: '100%', color: 'bg-green-500', text: 'Complete' },
		rejected: { width: '100%', color: 'bg-red-500', text: 'Needs Revision' },
	}

	const config = progressConfig[status as keyof typeof progressConfig] || {
		width: '0%',
		color: 'bg-gray-500',
		text: 'Unknown',
	}

	return (
		<div className='w-full'>
			<div className='flex justify-between items-center mb-1'>
				<span className='text-xs text-gray-600 dark:text-gray-400'>{config.text}</span>
			</div>
			<div className='w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2'>
				<div
					className={`h-2 rounded-full transition-all duration-500 ${config.color}`}
					style={{ width: config.width }}
				></div>
			</div>
		</div>
	)
}
