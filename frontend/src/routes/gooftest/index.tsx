import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState, useRef } from 'react'
import { PDFViewer, type PDFViewerRef } from '../pdftest/components/PDFViewer'

export const Route = createFileRoute('/gooftest/')({
  component: RouteComponent,
})

interface Annotation {
  id: string
  startX: number
  startY: number
  endX: number
  endY: number
  pageNumber: number
  label: string
}

// Example PDF from the internet - using a sample PDF URL
const EXAMPLE_PDF_URL = 'file:///C:/Users/jadot/Downloads/TC5_Testing_Multiple_Non_Compliance_Categorization.pdf'

// Define some example annotations
const ANNOTATIONS: Annotation[] = [
  {
    id: 'annotation-1',
    startX: 100,
    startY: 100,
    endX: 300,
    endY: 200,
    pageNumber: 1,
    label: 'Annotation 1'
  },
  {
    id: 'annotation-2',
    startX: 400,
    startY: 300,
    endX: 600,
    endY: 400,
    pageNumber: 1,
    label: 'Annotation 2'
  },
  {
    id: 'annotation-3',
    startX: 200,
    startY: 500,
    endX: 500,
    endY: 600,
    pageNumber: 1,
    label: 'Annotation 3'
  },
]

function RouteComponent() {
  const pdfViewerRef = useRef<PDFViewerRef>(null)
  const [isDocumentLoaded, setIsDocumentLoaded] = useState(false)
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null)

  // Add annotations when document is loaded
  useEffect(() => {
    if (!isDocumentLoaded || !pdfViewerRef.current) {
      return
    }

    // Wait a bit for the document to be fully rendered before adding annotations
    const timeoutId = setTimeout(() => {
      if (pdfViewerRef.current) {
        ANNOTATIONS.forEach((annotation) => {
          pdfViewerRef.current?.addAnnotation(
            annotation.startX,
            annotation.startY,
            annotation.endX,
            annotation.endY,
            annotation.pageNumber,
            annotation.id
          )
        })
      }
    }, 500)

    return () => {
      clearTimeout(timeoutId)
    }
  }, [isDocumentLoaded])

  const handleLoadComplete = () => {
    setIsDocumentLoaded(true)
  }

  const handleAnnotationSelected = (id: string | null) => {
    setSelectedAnnotationId(id)
  }

  const selectNextAnnotation = () => {
    const currentIndex = selectedAnnotationId 
      ? ANNOTATIONS.findIndex(a => a.id === selectedAnnotationId)
      : -1
    
    const nextIndex = (currentIndex + 1) % ANNOTATIONS.length
    const nextAnnotation = ANNOTATIONS[nextIndex]
    
    if (pdfViewerRef.current && nextAnnotation) {
      pdfViewerRef.current.selectAnnotationById(nextAnnotation.id)
    }
  }

  const selectPreviousAnnotation = () => {
    const currentIndex = selectedAnnotationId 
      ? ANNOTATIONS.findIndex(a => a.id === selectedAnnotationId)
      : -1
    
    const prevIndex = currentIndex <= 0 
      ? ANNOTATIONS.length - 1 
      : currentIndex - 1
    const prevAnnotation = ANNOTATIONS[prevIndex]
    
    if (pdfViewerRef.current && prevAnnotation) {
      pdfViewerRef.current.selectAnnotationById(prevAnnotation.id)
    }
  }

  return (
    <div className="flex flex-col h-screen w-full">
      <div className="bg-gray-100 border-b border-gray-200 p-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">PDF Viewer with Annotations</h1>
        <div className="flex gap-2 items-center">
          <button
            onClick={selectPreviousAnnotation}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            disabled={ANNOTATIONS.length === 0}
          >
            Previous Annotation
          </button>
          <button
            onClick={selectNextAnnotation}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            disabled={ANNOTATIONS.length === 0}
          >
            Next Annotation
          </button>
          {selectedAnnotationId && (
            <span className="ml-4 text-sm text-gray-600">
              Selected: {ANNOTATIONS.find(a => a.id === selectedAnnotationId)?.label || selectedAnnotationId}
            </span>
          )}
        </div>
      </div>
      <div className="flex-1 overflow-hidden">
        <PDFViewer
          ref={pdfViewerRef}
          documentUrl={EXAMPLE_PDF_URL}
          onLoadComplete={handleLoadComplete}
          onAnnotationSelected={handleAnnotationSelected}
          className="w-full h-full"
        />
      </div>
    </div>
  )
}
