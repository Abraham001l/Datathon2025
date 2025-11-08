import type { Toast } from '../types'

interface ToastContainerProps {
	toasts: Toast[]
	onClose: (id: string) => void
}

export function ToastContainer({ toasts, onClose }: ToastContainerProps) {
	if (toasts.length === 0) return null

	return (
		<div className='fixed top-4 right-4 z-50 space-y-2'>
			{toasts.map((toast) => {
				const colors = {
					success: 'bg-green-500',
					error: 'bg-red-500',
					warning: 'bg-yellow-500',
					info: 'bg-blue-500',
				}
				return (
					<div
						key={toast.id}
						className={`${colors[toast.type]} text-white px-4 py-3 rounded-lg shadow-lg max-w-sm flex justify-between items-start`}
					>
						<div>
							<div className='font-semibold'>{toast.title}</div>
							<div className='text-sm'>{toast.message}</div>
						</div>
						<button onClick={() => onClose(toast.id)} className='ml-4 text-white hover:text-gray-200'>
							✕
						</button>
					</div>
				)
			})}
		</div>
	)
}
