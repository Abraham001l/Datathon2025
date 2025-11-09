import { motion, AnimatePresence } from 'motion/react'
import type { Toast } from '../types'

interface ToastContainerProps {
	toasts: Toast[]
	onClose: (id: string) => void
}

const toastConfig = {
	success: {
		bg: 'bg-white',
		iconColor: 'text-green-600',
		borderColor: 'border-l-green-500',
		icon: (
			<svg className='w-4 h-4' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
				<path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M5 13l4 4L19 7' />
			</svg>
		),
	},
	error: {
		bg: 'bg-white',
		iconColor: 'text-red-600',
		borderColor: 'border-l-red-500',
		icon: (
			<svg className='w-4 h-4' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
				<path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M6 18L18 6M6 6l12 12' />
			</svg>
		),
	},
	warning: {
		bg: 'bg-white',
		iconColor: 'text-amber-600',
		borderColor: 'border-l-amber-500',
		icon: (
			<svg className='w-4 h-4' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
				<path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z' />
			</svg>
		),
	},
	info: {
		bg: 'bg-white',
		iconColor: 'text-blue-600',
		borderColor: 'border-l-blue-500',
		icon: (
			<svg className='w-4 h-4' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
				<path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' />
			</svg>
		),
	},
}

export function ToastContainer({ toasts, onClose }: ToastContainerProps) {
	return (
		<div className='fixed top-4 right-4 z-50 space-y-2 pointer-events-none max-w-sm'>
			<AnimatePresence>
				{toasts.map((toast) => {
					const config = toastConfig[toast.type]
					return (
						<motion.div
							key={toast.id}
							initial={{ opacity: 0, y: -20, scale: 0.95 }}
							animate={{ opacity: 1, y: 0, scale: 1 }}
							exit={{ opacity: 0, x: 100, scale: 0.95 }}
							transition={{ duration: 0.2 }}
							className={`${config.bg} ${config.borderColor} border-l-4 rounded-md shadow-lg pointer-events-auto`}
						>
							<div className='p-3 flex items-start gap-2.5'>
								{/* Icon */}
								<div className={`flex-shrink-0 mt-0.5 ${config.iconColor}`}>
									{config.icon}
								</div>

								{/* Content */}
								<div className='flex-1 min-w-0'>
									<div className='font-medium text-sm text-gray-900 mb-0.5'>
										{toast.title}
									</div>
									<div className='text-xs text-gray-600 leading-snug'>
										{toast.message}
									</div>
								</div>

								{/* Close Button */}
								<button
									onClick={() => onClose(toast.id)}
									className='flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors p-0.5 rounded hover:bg-gray-100'
									aria-label='Close notification'
								>
									<svg className='w-3.5 h-3.5' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
										<path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M6 18L18 6M6 6l12 12' />
									</svg>
								</button>
							</div>
						</motion.div>
					)
				})}
			</AnimatePresence>
		</div>
	)
}
