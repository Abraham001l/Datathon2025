interface SelectionHeaderProps {
  currentIndex: number
  totalCount: number
  viewMode: 'text' | 'image'
}

export function SelectionHeader({ currentIndex, totalCount, viewMode }: SelectionHeaderProps) {
  return (
    <div className="px-6 pt-4 pb-4 border-b border-gray-200">
      <h3 className="text-base font-semibold text-gray-900 mb-2">Selection</h3>
      <div className="flex items-baseline gap-1">
        <span className="text-3xl font-bold text-gray-900">
          {currentIndex >= 0 && totalCount > 0 ? currentIndex + 1 : 0}
        </span>
        <span className="text-3xl font-bold text-gray-900">/</span>
        <span className="text-3xl font-bold text-gray-900">
          {totalCount > 0 ? totalCount : 0}
        </span>
        <span className="text-base font-normal text-gray-700 ml-1">
          {viewMode === 'text' ? 'boxes' : 'images'}
        </span>
      </div>
    </div>
  )
}

