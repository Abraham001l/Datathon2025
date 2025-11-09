interface CircularProgressBarProps {
  percentage: number
  size?: number
  strokeWidth?: number
  className?: string
}

export function CircularProgressBar({ 
  percentage, 
  size = 80, 
  strokeWidth = 8,
  className = ''
}: CircularProgressBarProps) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (percentage / 100) * circumference
  
  // Color based on percentage
  const getColor = (percent: number) => {
    if (percent >= 80) return '#10b981' // green-500
    if (percent >= 60) return '#3b82f6' // blue-500
    if (percent >= 40) return '#f59e0b' // amber-500
    return '#ef4444' // red-500
  }

  const color = getColor(percentage)

  return (
    <div className={`relative inline-flex items-center justify-center ${className}`}>
      <svg width={size} height={size} className="transform -rotate-90">
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#e5e7eb"
          strokeWidth={strokeWidth}
          fill="none"
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-500 ease-in-out"
        />
      </svg>
      {/* Percentage text */}
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-sm font-semibold text-gray-700">
          {percentage.toFixed(0)}%
        </span>
      </div>
    </div>
  )
}

