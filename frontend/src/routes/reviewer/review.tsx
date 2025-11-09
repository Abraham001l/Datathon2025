import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { AnnotatedPDFViewer } from '../pdftest/components/AnnotatedPDFViewer'
import { apiService } from '../upload/api'
import type { Document } from '../upload/types'

export const Route = createFileRoute('/reviewer/review')({
  component: ReviewComponent,
  validateSearch: (search: Record<string, unknown>) => {
    return {
      docid: (search.docid as string) || null,
    }
  },
})

function ReviewComponent() {
  const { docid } = Route.useSearch()
  const navigate = useNavigate()
  const [document, setDocument] = useState<Document | null>(null)
  const [allDocuments, setAllDocuments] = useState<Document[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchDocument = async () => {
      if (!docid) {
        setIsLoading(false)
        return
      }

      try {
        setIsLoading(true)
        // Fetch all documents and find the one with matching ID
        const response = await apiService.getDocuments(100)
        setAllDocuments(response.files)
        const foundDoc = response.files.find((doc) => doc.file_id === docid)
        
        if (foundDoc) {
          setDocument(foundDoc)
        } else {
          console.error('Document not found:', docid)
        }
      } catch (err) {
        console.error('Failed to fetch document:', err)
      } finally {
        setIsLoading(false)
      }
    }

    fetchDocument()
  }, [docid])

  // Find current document index and calculate next/previous
  const currentIndex = allDocuments.findIndex((doc) => doc.file_id === docid)
  const previousDoc = currentIndex > 0 ? allDocuments[currentIndex - 1] : null
  const nextDoc = currentIndex < allDocuments.length - 1 ? allDocuments[currentIndex + 1] : null
  const isFirst = currentIndex === 0
  const isLast = currentIndex === allDocuments.length - 1

  const handlePrevious = () => {
    if (previousDoc) {
      navigate({
        to: '/reviewer/review',
        search: { docid: previousDoc.file_id },
      })
    }
  }

  const handleNext = () => {
    if (nextDoc) {
      navigate({
        to: '/reviewer/review',
        search: { docid: nextDoc.file_id },
      })
    }
  }

  if (!docid) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 mb-4">No document ID provided</p>
          <button
            onClick={() => navigate({ to: '/reviewer/queue' })}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            Go to Queue
          </button>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">Loading document...</p>
      </div>
    )
  }

  if (!document) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 mb-4">Document not found</p>
          <button
            onClick={() => navigate({ to: '/reviewer/queue' })}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            Go to Queue
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden bg-gray-50">
      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Left Column: PDF Viewer - Full height, touches edges */}
        <div className="flex-1 flex flex-col bg-white border-r border-gray-200 overflow-hidden min-h-0">
          <div className="flex-1 overflow-auto min-h-0">
            <AnnotatedPDFViewer
              documentId={docid}
              filename={document.filename}
              apiBaseUrl={import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'}
            />
          </div>
        </div>

        {/* Right Column: AI Decisions - Smaller width */}
        <div className="w-80 bg-white border-l border-gray-200 flex flex-col overflow-hidden min-h-0">
          <div className="p-4 border-b border-gray-200 shrink-0">
            <h2 className="text-lg font-semibold text-gray-900">Makoto Review:</h2>
          </div>
          <div className="flex-1 overflow-auto p-6 min-h-0">
            <p className="text-gray-500 text-center">Placeholder</p>
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="h-16 bg-white border-t border-gray-200 flex items-center justify-between px-6 shrink-0">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-semibold text-gray-900">
            {document.filename || 'Document Viewer'}
          </h2>
          <p className="text-sm text-gray-500">File ID: {document.file_id}</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handlePrevious}
            disabled={isFirst}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              isFirst
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Previous
          </button>
          <button
            onClick={handleNext}
            disabled={isLast}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              isLast
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Next
          </button>
          <button
            onClick={() => navigate({ to: '/reviewer/queue' })}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
          >
            Back to Queue
          </button>
        </div>
      </div>
    </div>
  )
}
