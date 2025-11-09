import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react'
import WebViewer from '@pdftron/webviewer'

export interface WebViewerInstance {
  Core: {
    documentViewer: {
      loadDocument: (url: string, options?: { filename?: string }) => void
      addEventListener: (event: string, callback: () => void) => void
      removeEventListener?: (event: string, callback: () => void) => void
      getDocument?: () => {
        getPageInfo?: (pageNum: number) => { width: number; height: number } | null
      } | null
    }
    annotationManager?: {
      addAnnotation: (annotation: unknown) => void
      redrawAnnotation: (annotation: unknown) => void
    }
    Annotations?: {
      RectangleAnnotation: new (options: {
        X: number
        Y: number
        Width: number
        Height: number
        PageNumber?: number
        StrokeColor: unknown
      }) => unknown
      Color: new (r: number, g: number, b: number, a: number) => unknown
    }
  }
  UI: {
    dispose: () => void
    ready?: () => Promise<void>
  }
}

const addAnnotation = (instance: WebViewerInstance, startX: number, startY: number, endX: number, endY: number, pageNumber?: number) => {
  const { annotationManager, Annotations, documentViewer } = instance.Core
  if (!annotationManager || !Annotations) {
    return
  }
  
  // Use provided page number or default to 1
  const targetPage = pageNumber || 1
  
  // Get actual PDF page dimensions for the specific page
  let actualPageWidth = 1758
  let actualPageHeight = 2275
  try {
    const doc = documentViewer.getDocument?.()
    const pageInfo = doc?.getPageInfo?.(targetPage)
    if (pageInfo) {
      actualPageWidth = pageInfo.width
      actualPageHeight = pageInfo.height
    }
  } catch {
    // Use defaults
  }
  
  // Scale coordinates from 1758x2275 reference to actual PDF dimensions
  const scaleX = actualPageWidth / 1758
  const scaleY = actualPageHeight / 2275
  
  const x = Math.min(startX, endX) * scaleX
  const y = Math.min(startY, endY) * scaleY
  const width = Math.abs(endX - startX) * scaleX
  const height = Math.abs(endY - startY) * scaleY
  
  const rect = new Annotations.RectangleAnnotation({
    X: x,
    Y: y,
    Width: width,
    Height: height,
    PageNumber: targetPage,
    StrokeColor: new Annotations.Color(255, 0, 0, 1),
  })
  
  // Make annotation locked, non-selectable, and non-editable
  if (rect && typeof rect === 'object') {
    const annotation = rect as { Locked?: boolean; NoSelect?: boolean; NoMove?: boolean; NoResize?: boolean; NoDelete?: boolean }
    annotation.Locked = true
    annotation.NoSelect = true
    annotation.NoMove = true
    annotation.NoResize = true
    annotation.NoDelete = true
  }
  
  annotationManager.addAnnotation(rect)
  annotationManager.redrawAnnotation(rect)
}

export interface PDFViewerRef {
  addAnnotation: (startX: number, startY: number, endX: number, endY: number, pageNumber?: number) => void
}

interface PDFViewerProps {
  documentUrl?: string | null
  documentId?: string | null
  apiBaseUrl?: string
  filename?: string
  onLoadStart?: () => void
  onLoadComplete?: () => void
  onError?: (error: string) => void
  className?: string
}

export const PDFViewer = forwardRef<PDFViewerRef, PDFViewerProps>(({
  documentUrl,
  documentId,
  apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000',
  filename,
  onLoadStart,
  onLoadComplete,
  onError,
  className = '',
}, ref) => {
  const viewer = useRef<HTMLDivElement>(null)
  const webViewerInstance = useRef<WebViewerInstance | null>(null)
  const isInitializing = useRef(false)
  const [isReady, setIsReady] = useState(false)

  // Store callbacks in refs to avoid dependency issues
  const onLoadStartRef = useRef(onLoadStart)
  const onLoadCompleteRef = useRef(onLoadComplete)
  const onErrorRef = useRef(onError)

  // Update refs when callbacks change
  useEffect(() => {
    onLoadStartRef.current = onLoadStart
    onLoadCompleteRef.current = onLoadComplete
    onErrorRef.current = onError
  }, [onLoadStart, onLoadComplete, onError])

  // Expose methods via ref
  useImperativeHandle(ref, () => ({
    addAnnotation: (startX: number, startY: number, endX: number, endY: number, pageNumber?: number) => {
      if (webViewerInstance.current) {
        try {
          addAnnotation(webViewerInstance.current, startX, startY, endX, endY, pageNumber)
        } catch (err) {
          console.error('Error adding annotation:', err)
        }
      }
    },
  }), [])

  const PDFTRON_LICENSE_KEY = import.meta.env.VITE_PDFTRON_LICENSE_KEY || ''

  // Initialize WebViewer
  useEffect(() => {
    // Prevent multiple initializations
    if (isInitializing.current || webViewerInstance.current || !viewer.current) {
      return
    }

    isInitializing.current = true
    const viewerElement = viewer.current

    // Clear any existing content in the viewer div
    if (viewerElement) {
      viewerElement.innerHTML = ''
    }

    WebViewer(
      {
        path: '/webviewer/lib',
        licenseKey: PDFTRON_LICENSE_KEY,
        disabledElements: [
          'toolsHeader',
          'toolsHeaderButton',
          'ribbons',
          'menuButton',
          'leftPanelButton',
          'viewControlsButton',
          'searchButton',
          'thumbnailsButton',
          'bookmarksButton',
          'layersButton',
          'notesButton',
          'textPopup',
          'annotationPopup',
          'contextMenuPopup',
          'toolbarGroup-View',
          'toolbarGroup-Annotate',
          'toolbarGroup-Insert',
          'toolbarGroup-Shapes',
          'toolbarGroup-Edit',
          'toolbarGroup-Forms',
          'toolbarGroup-FillAndSign',
          'toolbarGroup-Share',
          'annotationContentEditPopup',
          'annotationStyleEditPopup',
          'annotationNoteConnectorLine',
          'annotationNoteConnectorEndpoint',
          'annotationNoteText',
          'annotationNoteState',
          'annotationNoteReply',
          'annotationNotePanel',
          'annotationNoteReplyPanel',
          'annotationNoteUnread',
          'annotationNoteRead',
          'annotationNoteExpand',
          'annotationNoteCollapse',
          'annotationNoteDelete',
          'annotationNoteEdit',
          'annotationNote',
          'annotationNoteConnector',
        ],
        initialDoc: '',
        enableAnnotations: true,
        enableMeasurement: false,
      },
      viewerElement
    )
      .then((instance) => {
        webViewerInstance.current = instance as WebViewerInstance
        instance.UI.setModularHeaders([]);


        // Wait for UI to be ready, then hide header elements except zoom
        const { UI } = instance as WebViewerInstance
        if (UI && typeof (UI as { ready?: () => Promise<void> }).ready === 'function') {
          (UI as { ready: () => Promise<void> }).ready().then(() => {
            // Hide header elements except zoom controls and annotation controls using CSS
            const style = document.createElement('style')
            style.textContent = `
              [data-element="header"] > *:not([data-element="zoomControls"]):not([class*="Zoom"]) {
                display: none !important;
              }
              [data-element="header"] [data-element="menuButton"],
              [data-element="header"] [data-element="toolsHeader"],
              [data-element="header"] [data-element="toolsHeaderButton"] {
                display: none !important;
              }
              /* Hide annotation controls */
              [data-element*="annotation"],
              [data-element*="Annotation"],
              [class*="annotation"],
              [class*="Annotation"],
              .Annotation,
              .annotation,
              [data-element="annotationPopup"],
              [data-element="annotationContentEditPopup"],
              [data-element="annotationStyleEditPopup"],
              [data-element="textPopup"],
              [data-element="contextMenuPopup"],
              .ToolbarGroup-Annotate,
              .ToolbarGroup-Insert,
              .ToolbarGroup-Shapes,
              .ToolbarGroup-Edit,
              .ToolbarGroup-Forms,
              .ToolbarGroup-FillAndSign {
                display: none !important;
              }
            `
            document.head.appendChild(style)
            
            isInitializing.current = false
            setIsReady(true)
          })
        } else {
          // Fallback: wait a bit for initialization
          setTimeout(() => {
            isInitializing.current = false
            setIsReady(true)
          }, 1000)
        }
      })
      .catch((err) => {
        console.error('Failed to initialize WebViewer:', err)
        isInitializing.current = false
        onErrorRef.current?.('Failed to initialize PDF viewer')
      })

    

    // Cleanup function
    return () => {
      if (webViewerInstance.current && webViewerInstance.current.UI) {
        try {
          webViewerInstance.current.UI.dispose()
        } catch (err) {
          console.error('Error disposing WebViewer:', err)
        }
        webViewerInstance.current = null
      }
      if (viewerElement) {
        viewerElement.innerHTML = ''
      }
      isInitializing.current = false
    }
  }, [PDFTRON_LICENSE_KEY])

  // Track previous document to prevent unnecessary reloads
  const previousDocumentRef = useRef<string | null>(null)

  // Load document when documentUrl or documentId changes, or when WebViewer becomes ready
  useEffect(() => {
    if (!webViewerInstance.current || !isReady) {
      return
    }

    // Don't load if both are null/undefined
    if (!documentUrl && !documentId) {
      return
    }

    // Create a unique key for the current document
    const currentDocumentKey = documentUrl || documentId || null

    // Skip if it's the same document
    if (currentDocumentKey === previousDocumentRef.current) {
      return
    }

    // Update the ref
    previousDocumentRef.current = currentDocumentKey

    const loadDocument = async () => {
      let url: string | null = null
      let documentFilename = filename

      try {
        onLoadStartRef.current?.()

        if (documentUrl) {
          // Use provided URL directly
          url = documentUrl
        } else if (documentId) {
          // Fetch document from API
          const response = await fetch(`${apiBaseUrl}/view/document/${documentId}`)

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({
              detail: 'Failed to fetch document',
            }))
            throw new Error(errorData.detail || `HTTP error! status: ${response.status}`)
          }

          // Get the PDF as a blob
          const blob = await response.blob()
          url = URL.createObjectURL(blob)
          documentFilename = documentFilename || `document-${documentId}.pdf`
        }

        if (!url) {
          return
        }

        // Load the document into WebViewer
        if (!webViewerInstance.current) {
          throw new Error('WebViewer instance is not available')
        }

        const { documentViewer } = webViewerInstance.current.Core

        // Ensure documentViewer is ready
        if (!documentViewer) {
          throw new Error('Document viewer is not ready')
        }

        // Set up one-time listener for document loaded
        let timeoutId: number | null = null
        let isComplete = false
        
        const handleDocumentLoaded = () => {
          if (isComplete) return // Prevent double calls
          isComplete = true
          
          if (timeoutId) {
            clearTimeout(timeoutId)
            timeoutId = null
          }
          // Remove the listener if available
          if (documentViewer.removeEventListener) {
            documentViewer.removeEventListener('documentLoaded', handleDocumentLoaded)
          }
          
          if (url && url.startsWith('blob:')) {
            URL.revokeObjectURL(url)
          }
          onLoadCompleteRef.current?.()
        }

        // Set up a timeout fallback in case the event doesn't fire (30 seconds)
        timeoutId = setTimeout(() => {
          console.warn('Document load timeout - assuming loaded')
          handleDocumentLoaded()
        }, 30000)

        // Add the listener before loading
        documentViewer.addEventListener('documentLoaded', handleDocumentLoaded)

        // Load the document
        documentViewer.loadDocument(url, {
          filename: documentFilename,
        })
      } catch (err) {
        if (url && url.startsWith('blob:')) {
          URL.revokeObjectURL(url)
        }
        const errorMessage = err instanceof Error ? err.message : 'Failed to load document'
        console.error('Error loading document:', err)
        onErrorRef.current?.(errorMessage)
        onLoadCompleteRef.current?.() // Reset loading state
      }
    }

    loadDocument()
  }, [documentUrl, documentId, apiBaseUrl, filename, isReady])

  return <div ref={viewer} className={className}></div>
})

PDFViewer.displayName = 'PDFViewer'

