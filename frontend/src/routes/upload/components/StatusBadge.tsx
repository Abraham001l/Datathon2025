interface StatusBadgeProps {
	status: string
}

export function StatusBadge({ status }: StatusBadgeProps) {
	const statusConfig = {
		in_queue: { color: 'bg-blue-100 text-blue-800', text: 'In Queue' },
		in_review: { color: 'bg-yellow-100 text-yellow-800', text: 'In Review' },
		pending_classification: { color: 'bg-blue-100 text-blue-800', text: 'Pending Classification' },
		accepted: { color: 'bg-green-100 text-green-800', text: 'Accepted' },
		rejected: { color: 'bg-red-100 text-red-800', text: 'Rejected' },
	}

	const config = statusConfig[status as keyof typeof statusConfig] || {
		color: 'bg-gray-100 text-gray-800',
		text: status,
	}

	return (
		<span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${config.color}`}>
			{config.text}
		</span>
	)
}
