import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react'
import { PDFViewer, type PDFViewerRef } from './PDFViewer'

export interface RectangleAnnotation {
  startX: number
  startY: number
  endX: number
  endY: number
  pageNumber?: number
  id?: string
}

export interface AnnotatedPDFViewerRef {
  selectAnnotationById: (annotationId: string) => void
  scrollToPage: (pageNumber: number) => void
}

interface AnnotatedPDFViewerProps {
  documentUrl?: string | null
  documentId?: string | null
  apiBaseUrl?: string
  filename?: string
  annotations?: RectangleAnnotation[]
  onLoadStart?: () => void
  onLoadComplete?: () => void
  onError?: (error: string) => void
  onAnnotationSelected?: (annotationId: string | null) => void
  className?: string
}

export const AnnotatedPDFViewer = forwardRef<AnnotatedPDFViewerRef, AnnotatedPDFViewerProps>(({
  documentUrl,
  documentId,
  apiBaseUrl,
  filename,
  annotations = [],
  onLoadStart,
  onLoadComplete,
  onError,
  onAnnotationSelected,
  className,
}, ref) => {
  const pdfViewerRef = useRef<PDFViewerRef>(null)
  const [isDocumentLoaded, setIsDocumentLoaded] = useState(false)
  const previousDocumentRef = useRef<string | null>(null)

  // Track document changes to reset loaded state
  useEffect(() => {
    const currentDocumentKey = documentUrl || documentId || null
    if (currentDocumentKey !== previousDocumentRef.current) {
      setIsDocumentLoaded(false)
      previousDocumentRef.current = currentDocumentKey
    }
  }, [documentUrl, documentId])

  // Add annotations when document is loaded
  useEffect(() => {
    if (!isDocumentLoaded || !pdfViewerRef.current || annotations.length === 0) {
      return
    }

    // Wait a bit for the document to be fully rendered before adding annotations
    const timeoutId = setTimeout(() => {
      if (pdfViewerRef.current) {
        annotations.forEach((annotation) => {
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
    }, 300)

    return () => {
      clearTimeout(timeoutId)
    }
  }, [isDocumentLoaded, annotations])

  // Expose methods via ref
  useImperativeHandle(ref, () => ({
    selectAnnotationById: (annotationId: string) => {
      pdfViewerRef.current?.selectAnnotationById(annotationId)
    },
    scrollToPage: (pageNumber: number) => {
      pdfViewerRef.current?.scrollToPage(pageNumber)
    },
  }), [])

  const handleLoadComplete = () => {
    setIsDocumentLoaded(true)
    onLoadComplete?.()
  }

  return (
    <PDFViewer
      ref={pdfViewerRef}
      documentUrl={documentUrl}
      documentId={documentId}
      apiBaseUrl={apiBaseUrl}
      filename={filename}
      onLoadStart={onLoadStart}
      onLoadComplete={handleLoadComplete}
      onError={onError}
      onAnnotationSelected={onAnnotationSelected}
      className={className}
    />
  )
})

AnnotatedPDFViewer.displayName = 'AnnotatedPDFViewer'

