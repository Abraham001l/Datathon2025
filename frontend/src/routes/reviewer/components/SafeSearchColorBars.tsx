interface SafeSearchData {
  adult: string
  spoof: string
  medical: string
  violence: string
  racy: string
}

interface SafeSearchColorBarsProps {
  safeSearch: SafeSearchData | undefined
}

function getSafeSearchColor(level: string): string {
  switch (level) {
    case 'VERY_LIKELY':
      return 'bg-red-600'
    case 'LIKELY':
      return 'bg-orange-500'
    case 'POSSIBLE':
      return 'bg-yellow-400'
    case 'UNLIKELY':
      return 'bg-green-400'
    case 'VERY_UNLIKELY':
      return 'bg-green-500'
    default:
      return 'bg-gray-300'
  }
}

function getSafeSearchIntensity(level: string): number {
  switch (level) {
    case 'VERY_LIKELY':
      return 100
    case 'LIKELY':
      return 80
    case 'POSSIBLE':
      return 50
    case 'UNLIKELY':
      return 20
    case 'VERY_UNLIKELY':
      return 10
    default:
      return 0
  }
}

export function SafeSearchColorBars({ safeSearch }: SafeSearchColorBarsProps) {
  if (!safeSearch) {
    return null
  }

  return (
    <div className="p-4 border-b border-gray-200">
      <h3 className="text-sm font-medium text-gray-700 mb-3">Safe Search Results</h3>
      <div className="space-y-3">
        {/* Adult */}
        <div>
          <div className="flex justify-between items-center mb-1">
            <span className="text-xs text-gray-600">Adult:</span>
            <span className="text-xs font-medium text-gray-900">{safeSearch.adult}</span>
          </div>
          <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={`h-full ${getSafeSearchColor(safeSearch.adult)} transition-all duration-300`}
              style={{ width: `${getSafeSearchIntensity(safeSearch.adult)}%` }}
            />
          </div>
        </div>
        {/* Spoof */}
        <div>
          <div className="flex justify-between items-center mb-1">
            <span className="text-xs text-gray-600">Spoof:</span>
            <span className="text-xs font-medium text-gray-900">{safeSearch.spoof}</span>
          </div>
          <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={`h-full ${getSafeSearchColor(safeSearch.spoof)} transition-all duration-300`}
              style={{ width: `${getSafeSearchIntensity(safeSearch.spoof)}%` }}
            />
          </div>
        </div>
        {/* Medical */}
        <div>
          <div className="flex justify-between items-center mb-1">
            <span className="text-xs text-gray-600">Medical:</span>
            <span className="text-xs font-medium text-gray-900">{safeSearch.medical}</span>
          </div>
          <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={`h-full ${getSafeSearchColor(safeSearch.medical)} transition-all duration-300`}
              style={{ width: `${getSafeSearchIntensity(safeSearch.medical)}%` }}
            />
          </div>
        </div>
        {/* Violence */}
        <div>
          <div className="flex justify-between items-center mb-1">
            <span className="text-xs text-gray-600">Violence:</span>
            <span className="text-xs font-medium text-gray-900">{safeSearch.violence}</span>
          </div>
          <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={`h-full ${getSafeSearchColor(safeSearch.violence)} transition-all duration-300`}
              style={{ width: `${getSafeSearchIntensity(safeSearch.violence)}%` }}
            />
          </div>
        </div>
        {/* Racy */}
        <div>
          <div className="flex justify-between items-center mb-1">
            <span className="text-xs text-gray-600">Racy:</span>
            <span className="text-xs font-medium text-gray-900">{safeSearch.racy}</span>
          </div>
          <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={`h-full ${getSafeSearchColor(safeSearch.racy)} transition-all duration-300`}
              style={{ width: `${getSafeSearchIntensity(safeSearch.racy)}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

