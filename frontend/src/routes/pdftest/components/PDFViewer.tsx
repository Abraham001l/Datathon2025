import { useEffect, useRef, useState } from 'react'
import WebViewer from '@pdftron/webviewer'

export interface WebViewerInstance {
  Core: {
    documentViewer: {
      loadDocument: (url: string, options?: { filename?: string }) => void
      addEventListener: (event: string, callback: () => void) => void
      removeEventListener?: (event: string, callback: () => void) => void
    }
  }
  UI: {
    dispose: () => void
    ready?: () => Promise<void>
  }
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

export function PDFViewer({
  documentUrl,
  documentId,
  apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000',
  filename,
  onLoadStart,
  onLoadComplete,
  onError,
  className = '',
}: PDFViewerProps) {
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
        ],
        initialDoc: '',
        enableAnnotations: false,
        enableMeasurement: false,
      },
      viewerElement
    )
      .then((instance: WebViewerInstance) => {
        webViewerInstance.current = instance
        
        // Wait for UI to be ready, then hide header elements except zoom
        const { UI } = instance
        if (UI && typeof UI.ready === 'function') {
          UI.ready().then(() => {
            // Hide header elements except zoom controls using CSS
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
}

