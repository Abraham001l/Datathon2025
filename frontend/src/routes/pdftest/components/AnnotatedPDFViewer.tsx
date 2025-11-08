import { useEffect, useRef, useState } from 'react'
import { PDFViewer, type PDFViewerRef } from './PDFViewer'

export interface RectangleAnnotation {
  startX: number
  startY: number
  endX: number
  endY: number
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
  className?: string
}

export const AnnotatedPDFViewer = ({
  documentUrl,
  documentId,
  apiBaseUrl,
  filename,
  annotations = [],
  onLoadStart,
  onLoadComplete,
  onError,
  className,
}: AnnotatedPDFViewerProps) => {
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
            annotation.endY
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
      className={className}
    />
  )
}

