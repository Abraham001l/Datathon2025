import { createFileRoute } from '@tanstack/react-router'
import { useState, useCallback } from 'react'
import { PDFViewer } from './components/PDFViewer'

export const Route = createFileRoute('/pdftest/')({
  component: RouteComponent,
})

function RouteComponent() {
  const [documentId, setDocumentId] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentDocumentId, setCurrentDocumentId] = useState<string | null>(null)

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
        </div>
        {error && (
          <div className="mt-2 p-2 bg-red-100 border border-red-400 text-red-700 rounded">
            {error}
          </div>
        )}
      </div>
      <PDFViewer
        documentId={currentDocumentId}
        onLoadStart={handleLoadStart}
        onLoadComplete={handleLoadComplete}
        onError={handleError}
        className="flex-1"
      />
    </div>
  )
}
