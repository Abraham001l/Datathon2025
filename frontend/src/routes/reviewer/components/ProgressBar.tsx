interface ProgressBarProps {
  currentIndex: number
  totalCount: number
}

export function ProgressBar({ currentIndex, totalCount }: ProgressBarProps) {
  const progress = totalCount > 0 ? ((currentIndex >= 0 ? currentIndex + 1 : 0) / totalCount) * 100 : 0

  return (
    <div className="p-4 border-b border-gray-200">
      <div className="relative w-full h-3 bg-gray-200 rounded-full overflow-hidden">
        {totalCount > 0 ? (
          <div
            className="absolute inset-y-0 left-0 bg-green-500 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        ) : (
          <div className="absolute inset-0 bg-gray-300 rounded-full" />
        )}
      </div>
      <p className="text-sm text-gray-700 mt-2">
        {totalCount > 0 && currentIndex >= 0
          ? `${currentIndex + 1} of ${totalCount} reviewed`
          : '0 of 0 reviewed'}
      </p>
    </div>
  )
}

