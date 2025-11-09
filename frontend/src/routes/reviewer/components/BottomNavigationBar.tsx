import { useNavigate } from '@tanstack/react-router'

interface BottomNavigationBarProps {
  documentFilename?: string
  documentId?: string
  currentIndex: number
  totalCount: number
  viewMode: 'text' | 'image'
  onPrevious: () => void
  onNext: () => void
  onPreviousCritical: () => void
  onNextCritical: () => void
  hasCriticalAnnotations: boolean
  isLoading: boolean
}

export function BottomNavigationBar({
  documentFilename,
  documentId,
  currentIndex,
  totalCount,
  viewMode,
  onPrevious,
  onNext,
  onPreviousCritical,
  onNextCritical,
  hasCriticalAnnotations,
  isLoading,
}: BottomNavigationBarProps) {
  const navigate = useNavigate()

  return (
    <div className="h-16 bg-white border-t border-gray-200 flex items-center justify-between px-6">
      <div className="flex items-center gap-4">
        <h2 className="text-lg font-semibold">{documentFilename || 'Document Viewer'}</h2>
        <p className="text-sm text-gray-500">File ID: {documentId || ''}</p>
        {totalCount > 0 && currentIndex >= 0 && (
          <p className="text-sm text-gray-500">
            {viewMode === 'text' ? 'Text' : 'Image'} {currentIndex + 1}/{totalCount}
          </p>
        )}
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={onPrevious}
          disabled={totalCount === 0 || isLoading}
          className="px-4 py-2 text-sm font-medium rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Previous {viewMode === 'text' ? 'Text' : 'Image'}
        </button>
        <button
          onClick={onNext}
          disabled={totalCount === 0 || isLoading}
          className="px-4 py-2 text-sm font-medium rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Next {viewMode === 'text' ? 'Text' : 'Image'}
        </button>
        <button
          onClick={onPreviousCritical}
          disabled={!hasCriticalAnnotations || isLoading}
          className="px-4 py-2 text-sm font-medium rounded-md bg-red-100 text-red-700 hover:bg-red-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Previous Critical
        </button>
        <button
          onClick={onNextCritical}
          disabled={!hasCriticalAnnotations || isLoading}
          className="px-4 py-2 text-sm font-medium rounded-md bg-red-100 text-red-700 hover:bg-red-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Next Critical
        </button>
        <button
          onClick={() => navigate({ to: '/reviewer/queue' })}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
        >
          Back to Queue
        </button>
      </div>
    </div>
  )
}

