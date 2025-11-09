import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import WebViewer from '@pdftron/webviewer'
import { API_BASE_URL } from '../../utils/apiConfig'

export const Route = createFileRoute('/gooftest/')({
  component: RouteComponent,
})

// Example PDF from the backend API
const DOCUMENT_ID = '691064c2062c2bde4f3e2406'

interface WebViewerInstance {
  Core: {
    documentViewer: {
      loadDocument: (url: string, options?: { filename?: string }) => void
      addEventListener: (event: string, callback: () => void) => void
      removeEventListener?: (event: string, callback: () => void) => void
      getDocument?: () => {
        getPageCount?: () => number
        getPageInfo?: (pageNum: number) => { width: number; height: number } | null
      } | null
    }
    annotationManager?: {
      addAnnotation: (annotation: unknown, options?: unknown) => void
      redrawAnnotation: (annotation: unknown) => void
      deselectAllAnnotations: () => void
      selectAnnotation?: (annotation: unknown) => void
      setSelectedAnnotations?: (annotations: unknown[]) => void
      jumpToAnnotation?: (annotation: unknown) => void
    }
    Annotations?: {
      RectangleAnnotation: new (options: {
        X: number
        Y: number
        Width: number
        Height: number
        PageNumber?: number
        StrokeColor: unknown
        FillColor?: unknown
        Subject?: string
      }) => unknown
      Color: new (r: number, g: number, b: number, a: number) => unknown
    }
  }
  UI: {
    dispose: () => void
  }
}

interface AnnotationInfo {
  id: string
  pageNumber: number
  annotation: unknown
}

function RouteComponent() {
  const viewer = useRef<HTMLDivElement>(null)
  const webViewerInstance = useRef<WebViewerInstance | null>(null)
  const annotationsRef = useRef<AnnotationInfo[]>([])
  const [annotations, setAnnotations] = useState<AnnotationInfo[]>([])
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null)

  // Create annotation on a page
  const createAnnotation = (instance: WebViewerInstance, pageNumber: number, id: string): unknown | null => {
    const { annotationManager, Annotations, documentViewer } = instance.Core
    if (!annotationManager || !Annotations) {
      return null
    }

    // Get page dimensions
    let pageWidth = 612 // Default letter size width in points
    let pageHeight = 792 // Default letter size height in points
    
    try {
      const doc = documentViewer.getDocument?.()
      const pageInfo = doc?.getPageInfo?.(pageNumber)
      if (pageInfo) {
        pageWidth = pageInfo.width
        pageHeight = pageInfo.height
      }
    } catch {
      // Use defaults
    }

    // Create annotation in the middle of the page
    const annotationWidth = 200
    const annotationHeight = 100
    const x = (pageWidth - annotationWidth) / 2
    const y = (pageHeight - annotationHeight) / 2

    const rect = new Annotations.RectangleAnnotation({
      X: x,
      Y: y,
      Width: annotationWidth,
      Height: annotationHeight,
      PageNumber: pageNumber,
      StrokeColor: new Annotations.Color(0, 0, 255, 1), // Blue border
      FillColor: new Annotations.Color(0, 0, 255, 0.1), // Light blue fill
      Subject: id,
    })

    // Make annotation non-editable but selectable
    if (rect && typeof rect === 'object') {
      const annotation = rect as {
        NoMove?: boolean
        NoResize?: boolean
        NoDelete?: boolean
      }
      annotation.NoMove = true
      annotation.NoResize = true
      annotation.NoDelete = true
    }

    annotationManager.addAnnotation(rect)
    annotationManager.redrawAnnotation(rect)

    return rect
  }

  // Select and jump to an annotation
  const selectAnnotation = (annotationId: string) => {
    if (!webViewerInstance.current) return

    const annotationInfo = annotationsRef.current.find(a => a.id === annotationId)
    if (!annotationInfo) return

    const { annotationManager } = webViewerInstance.current.Core
    if (!annotationManager) return

    // Deselect all first
    annotationManager.deselectAllAnnotations()

    // Select the annotation
    setTimeout(() => {
      if (!annotationManager || !webViewerInstance.current) return

      if (annotationManager.setSelectedAnnotations) {
        annotationManager.setSelectedAnnotations([annotationInfo.annotation])
      } else if (annotationManager.selectAnnotation) {
        annotationManager.selectAnnotation(annotationInfo.annotation)
      }

      annotationManager.redrawAnnotation(annotationInfo.annotation)

      // Jump to the annotation
      if (annotationManager.jumpToAnnotation) {
        annotationManager.jumpToAnnotation(annotationInfo.annotation)
      }
    }, 100)

    setSelectedAnnotationId(annotationId)
  }

  useEffect(() => {
    if (!viewer.current) {
      return
    }

    const PDFTRON_LICENSE_KEY = import.meta.env.VITE_PDFTRON_LICENSE_KEY || ''

    WebViewer(
      {
        path: '/webviewer/lib',
        licenseKey: PDFTRON_LICENSE_KEY,
        initialDoc: '', // Load document after initialization
      },
      viewer.current
    ).then(async (instance) => {
      webViewerInstance.current = instance as unknown as WebViewerInstance
      
      // Fetch document from API and load it
      try {
        const response = await fetch(`${API_BASE_URL}/view/document/${DOCUMENT_ID}`)
        
        if (!response.ok) {
          throw new Error(`Failed to fetch document: ${response.status}`)
        }

        const blob = await response.blob()
        const url = URL.createObjectURL(blob)

        // Load the document
        const { documentViewer } = instance.Core
        
        // Wait for document to load, then create annotations
        const handleDocumentLoaded = () => {
          URL.revokeObjectURL(url)

          // Get page count and create annotations
          const doc = documentViewer.getDocument?.()
          const pageCount = doc?.getPageCount?.() || 1

          const newAnnotations: AnnotationInfo[] = []
          
          // Create an annotation on each page
          for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
            const annotationId = `annotation-page-${pageNum}`
            const annotation = createAnnotation(instance as unknown as WebViewerInstance, pageNum, annotationId)
            
            if (annotation) {
              newAnnotations.push({
                id: annotationId,
                pageNumber: pageNum,
                annotation,
              })
            }
          }

          annotationsRef.current = newAnnotations
          setAnnotations(newAnnotations)

          // Remove the event listener
          documentViewer.removeEventListener?.('documentLoaded', handleDocumentLoaded)
        }

        documentViewer.addEventListener('documentLoaded', handleDocumentLoaded)
        
        documentViewer.loadDocument(url, {
          filename: `document-${DOCUMENT_ID}.pdf`,
        })
      } catch (error) {
        console.error('Error loading document:', error)
      }
    })

    return () => {
      // Cleanup WebViewer instance
      if (webViewerInstance.current) {
        webViewerInstance.current.UI.dispose()
        webViewerInstance.current = null
      }
    }
  }, [])

  return (
    <div className="flex flex-col h-screen w-full">
      <div className="bg-gray-100 border-b border-gray-200 p-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">PDF Viewer with Annotations</h1>
        <div className="flex gap-2 items-center flex-wrap">
          {annotations.map((annotation) => (
            <button
              key={annotation.id}
              onClick={() => selectAnnotation(annotation.id)}
              className={`px-4 py-2 rounded-md transition-colors ${
                selectedAnnotationId === annotation.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
              }`}
            >
              Page {annotation.pageNumber}
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1 overflow-hidden">
        <div ref={viewer} className="w-full h-full" />
      </div>
    </div>
  )
}
