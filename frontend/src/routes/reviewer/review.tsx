import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState, useEffect, useRef } from 'react'
import { AnnotatedPDFViewer, type RectangleAnnotation } from '../pdftest/components/AnnotatedPDFViewer'
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
  const [boundingBoxes, setBoundingBoxes] = useState<RectangleAnnotation[]>([])
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Fetch document
  useEffect(() => {
    if (!docid) {
      setIsLoading(false)
      return
    }

    // Clear any existing timeout when document changes
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }

    const fetchDocument = async () => {
      try {
        setIsLoading(true)
        const response = await apiService.getDocuments(100)
        setAllDocuments(response.files)
        const foundDoc = response.files.find((doc) => doc.file_id === docid)
        setDocument(foundDoc || null)
        // Keep loading true - will be set to false when PDF loads
      } catch (err) {
        console.error('Failed to fetch document:', err)
        setIsLoading(false)
      }
    }

    fetchDocument()
  }, [docid])

  // Fetch bounding boxes
  useEffect(() => {
    if (!docid) {
      setBoundingBoxes([])
      return
    }

    const fetchBoundingBoxes = async () => {
      try {
        const pages = await apiService.getDocumentBoundingBoxes(docid)
        const annotations: RectangleAnnotation[] = []

        pages.forEach((page) => {
          const pageNumber = page.page_number || 1
          page.bounding_boxes?.forEach((box) => {
            const vertices = box.bounding_box?.vertices || []
            if (vertices.length >= 2) {
              const xs = vertices.map((v) => v.x)
              const ys = vertices.map((v) => v.y)
              annotations.push({
                startX: Math.min(...xs),
                startY: Math.min(...ys),
                endX: Math.max(...xs),
                endY: Math.max(...ys),
                pageNumber: pageNumber,
              })
            }
          })
        })

        setBoundingBoxes(annotations)
      } catch (err) {
        console.error('Failed to fetch bounding boxes:', err)
        setBoundingBoxes([])
      }
    }

    fetchBoundingBoxes()
  }, [docid])

  // Navigation helpers
  const currentIndex = allDocuments.findIndex((doc) => doc.file_id === docid)
  const previousDoc = currentIndex > 0 ? allDocuments[currentIndex - 1] : null
  const nextDoc = currentIndex < allDocuments.length - 1 ? allDocuments[currentIndex + 1] : null

  const handlePrevious = () => {
    if (previousDoc) {
      navigate({ to: '/reviewer/review', search: { docid: previousDoc.file_id } })
    }
  }

  const handleNext = () => {
    if (nextDoc) {
      navigate({ to: '/reviewer/review', search: { docid: nextDoc.file_id } })
    }
  }

  const handlePDFLoadComplete = () => {
    // Keep loading visible for 3 seconds after PDF is fully loaded
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => {
      setIsLoading(false)
      timeoutRef.current = null
    }, 3000)
  }

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  if (!docid) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 mb-4">No document ID provided</p>
          <button
            onClick={() => navigate({ to: '/reviewer/queue' })}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Go to Queue
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden bg-gray-50">
      <div className="flex-1 flex overflow-hidden">
        {/* PDF Viewer */}
        <div className="flex-1 flex flex-col bg-white border-r border-gray-200 overflow-hidden">
          <div className="flex-1 overflow-auto relative">
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-white z-10">
                <div className="flex flex-col items-center gap-4">
                  <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
                  <p className="text-gray-500 text-sm">Loading document...</p>
                </div>
              </div>
            )}
            {!isLoading && !document && (
              <div className="absolute inset-0 flex items-center justify-center bg-white">
                <div className="text-center">
                  <p className="text-gray-500 mb-4">Document not found</p>
                  <button
                    onClick={() => navigate({ to: '/reviewer/queue' })}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  >
                    Go to Queue
                  </button>
                </div>
              </div>
            )}
            {document && (
              <AnnotatedPDFViewer
                documentId={docid}
                filename={document.filename}
                apiBaseUrl={import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'}
                onLoadComplete={handlePDFLoadComplete}
                annotations={boundingBoxes}
              />
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="w-80 bg-white border-l border-gray-200 flex flex-col">
          <div className="p-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold">Makoto Review:</h2>
          </div>
          <div className="flex-1 overflow-auto p-6">
            <p className="text-gray-500 text-center">Placeholder</p>
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="h-16 bg-white border-t border-gray-200 flex items-center justify-between px-6">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-semibold">{document?.filename || 'Document Viewer'}</h2>
          <p className="text-sm text-gray-500">File ID: {document?.file_id || docid}</p>
          {allDocuments.length > 0 && currentIndex >= 0 && (
            <p className="text-sm text-gray-500">
              Document {currentIndex + 1}/{allDocuments.length}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handlePrevious}
            disabled={!previousDoc || isLoading}
            className="px-4 py-2 text-sm font-medium rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          <button
            onClick={handleNext}
            disabled={!nextDoc || isLoading}
            className="px-4 py-2 text-sm font-medium rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
          </button>
          <button
            onClick={() => navigate({ to: '/reviewer/queue' })}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
          >
            Back to Queue
          </button>
        </div>
      </div>
    </div>
  )
}
