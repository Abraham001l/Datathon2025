interface ViewModeSelectorProps {
  viewMode: 'text' | 'image'
  onViewModeChange: (mode: 'text' | 'image') => void
}

export function ViewModeSelector({ viewMode, onViewModeChange }: ViewModeSelectorProps) {
  return (
    <div className="p-4 border-b border-gray-200">
      <div className="relative bg-gray-100 rounded-lg p-1 flex">
        <div
          className={`absolute top-1 bottom-1 w-1/2 bg-white rounded-md shadow-sm transition-transform duration-300 ease-in-out ${
            viewMode === 'image' ? 'translate-x-full' : 'translate-x-0'
          }`}
        />
        <button
          onClick={() => onViewModeChange('text')}
          className={`relative z-10 flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors duration-300 ${
            viewMode === 'text' ? 'text-gray-900' : 'text-gray-600'
          }`}
        >
          Text
        </button>
        <button
          onClick={() => onViewModeChange('image')}
          className={`relative z-10 flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors duration-300 ${
            viewMode === 'image' ? 'text-gray-900' : 'text-gray-600'
          }`}
        >
          Image
        </button>
      </div>
    </div>
  )
}

