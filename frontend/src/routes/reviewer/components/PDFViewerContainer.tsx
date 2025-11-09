import { type RefObject } from 'react'
import { AnnotatedPDFViewer, type AnnotatedPDFViewerRef, type RectangleAnnotation } from '../../pdftest/components/AnnotatedPDFViewer'
import type { Document } from '../../upload/types'

interface PDFViewerContainerProps {
  document: Document | null
  documentId: string | null
  isLoading: boolean
  pdfViewerRef: RefObject<AnnotatedPDFViewerRef>
  annotations: RectangleAnnotation[]
  onLoadComplete: () => void
  onAnnotationSelected: (id: string | null) => void
  viewMode: 'text' | 'image'
  onNavigate: (to: string) => void
}

export function PDFViewerContainer({
  document,
  documentId,
  isLoading,
  pdfViewerRef,
  annotations,
  onLoadComplete,
  onAnnotationSelected,
  viewMode,
  onNavigate,
}: PDFViewerContainerProps) {
  const handleAnnotationSelected = (id: string | null) => {
    if (!id) {
      onAnnotationSelected(null)
      return
    }

    // Check if it's an image annotation (starts with "img-")
    const isImageAnnotation = id.startsWith('img-')

    if (viewMode === 'text') {
      // In text mode, only allow selecting text annotations
      if (!isImageAnnotation) {
        onAnnotationSelected(id)
      } else {
        // Ignore image annotation selection in text mode
        onAnnotationSelected(null)
      }
    } else {
      // In image mode, only allow selecting image annotations
      if (isImageAnnotation) {
        onAnnotationSelected(id)
      } else {
        // Ignore text annotation selection in image mode
        onAnnotationSelected(null)
      }
    }
  }

  return (
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
                onClick={() => onNavigate('/reviewer/queue')}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Go to Queue
              </button>
            </div>
          </div>
        )}
        {document && (
          <AnnotatedPDFViewer
            ref={pdfViewerRef}
            documentId={documentId}
            filename={document.filename}
            apiBaseUrl={import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'}
            onLoadComplete={onLoadComplete}
            annotations={annotations}
            onAnnotationSelected={handleAnnotationSelected}
          />
        )}
      </div>
    </div>
  )
}

