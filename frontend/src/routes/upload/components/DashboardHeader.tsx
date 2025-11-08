export function DashboardHeader() {
	return (
		<div className='bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700'>
			<div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
				<div className='flex justify-between items-center py-4'>
					<div>
						<h1 className='text-2xl font-bold text-gray-900 dark:text-white'>Submission Dashboard</h1>
						<p className='text-sm text-gray-500 dark:text-gray-400'>
							Document Submission & Status Tracking
						</p>
					</div>
				</div>
			</div>
		</div>
	)
}
