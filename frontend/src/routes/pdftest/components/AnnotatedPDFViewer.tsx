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
  deselectAnnotations: () => void
  clearAnnotations: () => void
  hideAllAnnotations: () => void
  showAllAnnotations: () => void
  hideAnnotationsByIds: (ids: Set<string>) => void
  showAnnotationsByIds: (ids: Set<string>) => void
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

  useImperativeHandle(ref, () => ({
    deselectAnnotations: () => {
      if (pdfViewerRef.current) {
        pdfViewerRef.current.deselectAnnotations()
      }
    },
    clearAnnotations: () => {
      if (pdfViewerRef.current) {
        pdfViewerRef.current.clearAnnotations()
      }
    },
    hideAllAnnotations: () => {
      if (pdfViewerRef.current) {
        pdfViewerRef.current.hideAllAnnotations()
      }
    },
    showAllAnnotations: () => {
      if (pdfViewerRef.current) {
        pdfViewerRef.current.showAllAnnotations()
      }
    },
    hideAnnotationsByIds: (ids: Set<string>) => {
      if (pdfViewerRef.current) {
        pdfViewerRef.current.hideAnnotationsByIds(ids)
      }
    },
    showAnnotationsByIds: (ids: Set<string>) => {
      if (pdfViewerRef.current) {
        pdfViewerRef.current.showAnnotationsByIds(ids)
      }
    },
  }), [])

  // Track document changes to reset loaded state
  useEffect(() => {
    const currentDocumentKey = documentUrl || documentId || null
    if (currentDocumentKey !== previousDocumentRef.current) {
      setIsDocumentLoaded(false)
      previousDocumentRef.current = currentDocumentKey
    }
  }, [documentUrl, documentId])

  // Add annotations when document is loaded or annotations change
  useEffect(() => {
    if (!isDocumentLoaded || !pdfViewerRef.current) {
      return
    }

    // Clear existing annotations first
    if (pdfViewerRef.current.clearAnnotations) {
      pdfViewerRef.current.clearAnnotations()
    }

    // If no annotations, just return
    if (annotations.length === 0) {
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

