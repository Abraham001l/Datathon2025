import { createFileRoute } from '@tanstack/react-router'
import { useState, useCallback, useEffect } from 'react'
import { AnnotatedPDFViewer } from './components/AnnotatedPDFViewer'

export const Route = createFileRoute('/pdftest/')({
  component: RouteComponent,
})

function RouteComponent() {
  const [documentId, setDocumentId] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentDocumentId, setCurrentDocumentId] = useState<string | null>(null)
  const [annotationCoordinatesList, setAnnotationsCoordinatesList] = useState<{ startX: number; startY: number; endX: number; endY: number }[]>([])

  useEffect(() => {
    setAnnotationsCoordinatesList([{ startX: 50, startY: 50, endX: 200, endY: 100 }, { startX: 100, startY: 100, endX: 300, endY: 200 }, { startX: 150, startY: 150, endX: 400, endY: 300 }])
  }, [])
  
  // Annotation coordinates
  const [startX, setStartX] = useState('50')
  const [startY, setStartY] = useState('50')
  const [endX, setEndX] = useState('200')
  const [endY, setEndY] = useState('100')

  const handleLoadDocument = () => {
    if (!documentId.trim()) {
      setError('Please enter a document ID')
      return
    }

    const trimmedId = documentId.trim()
    // Only update if it's a different document ID
    if (trimmedId !== currentDocumentId) {
      setError(null)
      setIsLoading(true)
      setCurrentDocumentId(trimmedId)
    }
  }

  const handleLoadStart = useCallback(() => {
    setIsLoading(true)
    setError(null)
  }, [])

  const handleLoadComplete = useCallback(() => {
    setIsLoading(false)
  }, [])

  const handleError = useCallback((errorMessage: string) => {
    setError(errorMessage)
    setIsLoading(false)
  }, [])

  return (
    <div className="flex flex-col h-screen">
      <div className="p-4 bg-gray-100 border-b">
        <div className="flex gap-4 items-end">
          <div className="flex-1">
            <label htmlFor="documentId" className="block text-sm font-medium text-gray-700 mb-1">
              Document ID
            </label>
            <input
              id="documentId"
              type="text"
              value={documentId}
              onChange={(e) => setDocumentId(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleLoadDocument()
                }
              }}
              placeholder="Enter document ID (e.g., 507f1f77bcf86cd799439011)"
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <button
            onClick={handleLoadDocument}
            disabled={isLoading || !documentId.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            {isLoading ? 'Loading...' : 'Load Document'}
          </button>
          <button
            onClick={() => {
              setAnnotationsCoordinatesList([...annotationCoordinatesList, { startX: parseFloat(startX), startY: parseFloat(startY), endX: parseFloat(endX), endY: parseFloat(endY) }])
            }}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
          >
            Add Test Annotation
          </button>
        </div>
        <div className="mt-4 flex gap-4 items-end">
          <div>
            <label htmlFor="startX" className="block text-sm font-medium text-gray-700 mb-1">
              Start X
            </label>
            <input
              id="startX"
              type="number"
              value={startX}
              onChange={(e) => setStartX(e.target.value)}
              className="w-24 px-2 py-1 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
            />
          </div>
          <div>
            <label htmlFor="startY" className="block text-sm font-medium text-gray-700 mb-1">
              Start Y
            </label>
            <input
              id="startY"
              type="number"
              value={startY}
              onChange={(e) => setStartY(e.target.value)}
              className="w-24 px-2 py-1 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
            />
          </div>
          <div>
            <label htmlFor="endX" className="block text-sm font-medium text-gray-700 mb-1">
              End X
            </label>
            <input
              id="endX"
              type="number"
              value={endX}
              onChange={(e) => setEndX(e.target.value)}
              className="w-24 px-2 py-1 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
            />
          </div>
          <div>
            <label htmlFor="endY" className="block text-sm font-medium text-gray-700 mb-1">
              End Y
            </label>
            <input
              id="endY"
              type="number"
              value={endY}
              onChange={(e) => setEndY(e.target.value)}
              className="w-24 px-2 py-1 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
            />
          </div>
        </div>
        {error && (
          <div className="mt-2 p-2 bg-red-100 border border-red-400 text-red-700 rounded">
            {error}
          </div>
        )}
      </div>
      <AnnotatedPDFViewer
        documentId={currentDocumentId}
        annotations={annotationCoordinatesList}
        onLoadStart={handleLoadStart}
        onLoadComplete={handleLoadComplete}
        onError={handleError}
        className="flex-1"
      />
    </div>
  )
}
