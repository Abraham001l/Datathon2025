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
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Two Column Layout: PDF Viewer (Left) and AI Decisions (Right) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column: PDF Viewer */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  {document.filename || 'Document Viewer'}
                </h2>
                <p className="text-sm text-gray-500">File ID: {document.file_id}</p>
              </div>
              <button
                onClick={() => navigate({ to: '/reviewer/queue' })}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
              >
                Back to Queue
              </button>
            </div>
            <div className="h-[600px] overflow-auto">
              <AnnotatedPDFViewer
                documentId={docid}
                filename={document.filename}
                apiBaseUrl={import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'}
              />
            </div>
          </div>

          {/* Right Column: AI Decisions Placeholder */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">AI Decisions</h2>
            </div>
            <div className="p-12 text-center">
              <p className="text-gray-500">Placeholder</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
