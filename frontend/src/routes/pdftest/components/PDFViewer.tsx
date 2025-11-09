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
      addEventListener: (event: string, callback: (annotations: unknown[], action?: string) => void) => void
      removeEventListener?: (event: string, callback: (annotations: unknown[], action?: string) => void) => void
      deselectAllAnnotations: () => void
      bringAnnotationToFront?: (annotation: unknown) => void
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
      }) => unknown
      Color: new (r: number, g: number, b: number, a: number) => unknown
    }
  }
  UI: {
    dispose: () => void
    ready?: () => Promise<void>
  }
}

const addAnnotation = (instance: WebViewerInstance, startX: number, startY: number, endX: number, endY: number, pageNumber?: number, id?: string) => {
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
    StrokeColor: new Annotations.Color(192, 192, 192, 1),
    // Use a very minimal fill (0.01 alpha) so the annotation captures clicks in the middle
    // This makes it clickable throughout the entire rectangle area, not just the edges
    FillColor: new Annotations.Color(255, 0, 0, 0.01),
    // Set the annotation number/ID if provided
    ...(id ? { Subject: id } : {}),
  })
  
  // Make annotation non-editable but still selectable/clickable
  if (rect && typeof rect === 'object') {
    const annotation = rect as { 
      Locked?: boolean
      NoSelect?: boolean
      NoMove?: boolean
      NoResize?: boolean
      NoDelete?: boolean
      FillColor?: unknown
      Opacity?: number
      ReadOnly?: boolean
    }
    // Allow selection/clicking but prevent editing
    annotation.Locked = false
    annotation.NoSelect = false
    annotation.NoMove = true
    annotation.NoResize = true
    annotation.NoDelete = true
    // Ensure annotation is not read-only so it can be selected
    annotation.ReadOnly = false
  }
  
  annotationManager.addAnnotation(rect)
  
  // Try to bring the annotation to the front so it's above text and clickable
  try {
    // Try annotationManager method first
    if (annotationManager.bringAnnotationToFront) {
      annotationManager.bringAnnotationToFront(rect)
    }
    // Also try if the annotation itself has a bringToFront method
    if (rect && typeof rect === 'object') {
      const annotation = rect as { bringToFront?: () => void }
      if (typeof annotation.bringToFront === 'function') {
        annotation.bringToFront()
      }
    }
  } catch (err) {
    // If bringing to front doesn't work, continue without it
    // The minimal fill should still make it clickable
    console.debug('Could not bring annotation to front:', err)
  }
  
  annotationManager.redrawAnnotation(rect)
  
  return rect
}

export interface PDFViewerRef {
  addAnnotation: (startX: number, startY: number, endX: number, endY: number, pageNumber?: number, id?: string) => void
  clearAnnotations: () => void
  deselectAnnotations: () => void
  hideAllAnnotations: () => void
  showAllAnnotations: () => void
  hideAnnotationsByIds: (ids: Set<string>) => void
  showAnnotationsByIds: (ids: Set<string>) => void
}

interface PDFViewerProps {
  documentUrl?: string | null
  documentId?: string | null
  apiBaseUrl?: string
  filename?: string
  onLoadStart?: () => void
  onLoadComplete?: () => void
  onError?: (error: string) => void
  onAnnotationSelected?: (annotationId: string | null) => void
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
  onAnnotationSelected,
  className = '',
}, ref) => {
  const viewer = useRef<HTMLDivElement>(null)
  const webViewerInstance = useRef<WebViewerInstance | null>(null)
  const isInitializing = useRef(false)
  const [isReady, setIsReady] = useState(false)
  const annotationsRef = useRef<Set<unknown>>(new Set())
  const selectedAnnotationRef = useRef<unknown | null>(null)

  // Store callbacks in refs to avoid dependency issues
  const onLoadStartRef = useRef(onLoadStart)
  const onLoadCompleteRef = useRef(onLoadComplete)
  const onErrorRef = useRef(onError)
  const onAnnotationSelectedRef = useRef(onAnnotationSelected)

  // Update refs when callbacks change
  useEffect(() => {
    onLoadStartRef.current = onLoadStart
    onLoadCompleteRef.current = onLoadComplete
    onErrorRef.current = onError
    onAnnotationSelectedRef.current = onAnnotationSelected
  }, [onLoadStart, onLoadComplete, onError, onAnnotationSelected])

  // Expose methods via ref
  useImperativeHandle(ref, () => ({
    addAnnotation: (startX: number, startY: number, endX: number, endY: number, pageNumber?: number, id?: string) => {
      if (webViewerInstance.current) {
        try {
          const annotation = addAnnotation(webViewerInstance.current, startX, startY, endX, endY, pageNumber, id)
          if (annotation) {
            annotationsRef.current.add(annotation)
            // Store the ID mapping
            if (id && annotation && typeof annotation === 'object') {
              const ann = annotation as { _id?: string }
              ann._id = id
            }
          }
        } catch (err) {
          console.error('Error adding annotation:', err)
        }
      }
    },
    clearAnnotations: () => {
      if (webViewerInstance.current) {
        const { annotationManager } = webViewerInstance.current.Core
        if (annotationManager) {
          try {
            // First, delete all annotations from our tracked set
            const annotationsToDelete = Array.from(annotationsRef.current)
            annotationsToDelete.forEach((annotation) => {
              try {
                if (annotation && typeof annotation === 'object') {
                  const ann = annotation as { delete?: () => void }
                  if (typeof ann.delete === 'function') {
                    ann.delete()
                  }
                }
              } catch (err) {
                console.error('Error deleting annotation:', err)
              }
            })
            annotationsRef.current.clear()
            
            // Also try to get all annotations from annotationManager and delete them
            // This catches any annotations that weren't in our ref
            try {
              // Try to get all annotations from the current page or document
              const doc = webViewerInstance.current.Core.documentViewer.getDocument?.()
              if (doc) {
                // Get all pages and delete annotations from each
                const pageCount = (doc as { getPageCount?: () => number })?.getPageCount?.() || 0
                for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
                  try {
                    const pageAnnotations = (annotationManager as { getAnnotationsList?: (pageNum: number) => unknown[] })?.getAnnotationsList?.(pageNum) || []
                    pageAnnotations.forEach((annotation: unknown) => {
                      try {
                        if (annotation && typeof annotation === 'object') {
                          const ann = annotation as { delete?: () => void; Subject?: string }
                          // Only delete our annotations (they have Subject set to their ID)
                          if (ann.Subject && typeof ann.delete === 'function') {
                            ann.delete()
                          }
                        }
                      } catch {
                        // Ignore errors for individual annotations
                      }
                    })
                  } catch {
                    // Ignore errors for individual pages
                  }
                }
              }
            } catch {
              // If we can't get all annotations, that's okay - we've at least cleared the tracked ones
            }
            
            selectedAnnotationRef.current = null
            annotationManager.deselectAllAnnotations()
          } catch (err) {
            console.error('Error clearing annotations:', err)
          }
        }
      }
    },
    deselectAnnotations: () => {
      if (webViewerInstance.current) {
        const { annotationManager, Annotations } = webViewerInstance.current.Core
        if (annotationManager && Annotations) {
          try {
            // Reset fill color for ALL annotations
            annotationsRef.current.forEach((annotation) => {
              try {
                if (annotation && typeof annotation === 'object') {
                  const ann = annotation as { FillColor?: unknown }
                  ann.FillColor = new Annotations.Color(255, 0, 0, 0.01)
                  annotationManager.redrawAnnotation(annotation)
                }
              } catch (err) {
                console.error('Error resetting annotation fill:', err)
              }
            })
            selectedAnnotationRef.current = null
            annotationManager.deselectAllAnnotations()
          } catch (err) {
            console.error('Error deselecting annotations:', err)
          }
        }
      }
    },
    hideAllAnnotations: () => {
      if (webViewerInstance.current) {
        const { annotationManager } = webViewerInstance.current.Core
        if (annotationManager) {
          try {
            annotationsRef.current.forEach((annotation) => {
              try {
                if (annotation && typeof annotation === 'object') {
                  const ann = annotation as { Hidden?: boolean }
                  ann.Hidden = true
                  annotationManager.redrawAnnotation(annotation)
                }
              } catch (err) {
                console.error('Error hiding annotation:', err)
              }
            })
          } catch (err) {
            console.error('Error hiding annotations:', err)
          }
        }
      }
    },
    showAllAnnotations: () => {
      if (webViewerInstance.current) {
        const { annotationManager } = webViewerInstance.current.Core
        if (annotationManager) {
          try {
            annotationsRef.current.forEach((annotation) => {
              try {
                if (annotation && typeof annotation === 'object') {
                  const ann = annotation as { Hidden?: boolean }
                  ann.Hidden = false
                  annotationManager.redrawAnnotation(annotation)
                }
              } catch (err) {
                console.error('Error showing annotation:', err)
              }
            })
          } catch (err) {
            console.error('Error showing annotations:', err)
          }
        }
      }
    },
    hideAnnotationsByIds: (ids: Set<string>) => {
      if (webViewerInstance.current) {
        const { annotationManager } = webViewerInstance.current.Core
        if (annotationManager) {
          try {
            annotationsRef.current.forEach((annotation) => {
              try {
                if (annotation && typeof annotation === 'object') {
                  const ann = annotation as { Hidden?: boolean; Subject?: string }
                  // Check if this annotation's ID is in the set
                  if (ann.Subject && ids.has(ann.Subject)) {
                    ann.Hidden = true
                    annotationManager.redrawAnnotation(annotation)
                  }
                }
              } catch (err) {
                console.error('Error hiding annotation:', err)
              }
            })
          } catch (err) {
            console.error('Error hiding annotations by IDs:', err)
          }
        }
      }
    },
    showAnnotationsByIds: (ids: Set<string>) => {
      if (webViewerInstance.current) {
        const { annotationManager } = webViewerInstance.current.Core
        if (annotationManager) {
          try {
            annotationsRef.current.forEach((annotation) => {
              try {
                if (annotation && typeof annotation === 'object') {
                  const ann = annotation as { Hidden?: boolean; Subject?: string }
                  // Check if this annotation's ID is in the set
                  if (ann.Subject && ids.has(ann.Subject)) {
                    ann.Hidden = false
                    annotationManager.redrawAnnotation(annotation)
                  }
                }
              } catch (err) {
                console.error('Error showing annotation:', err)
              }
            })
          } catch (err) {
            console.error('Error showing annotations by IDs:', err)
          }
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
        // @ts-expect-error - enableReadOnlyMode is a valid PDFTron option but may not be in TypeScript types
        enableReadOnlyMode: true,
        enableAnnotationNumbering: true,
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

  // Set up annotation selection event listener
  useEffect(() => {
    if (!webViewerInstance.current || !isReady) {
      return
    }

    const { annotationManager, Annotations } = webViewerInstance.current.Core
    if (!annotationManager || !Annotations) {
      return
    }

    // Handle annotation selection event - this triggers the color change
    const handleAnnotationSelected = (annotations: unknown[]) => {
      if (annotations.length === 0) {
        // Deselected - reset previous annotation fill to minimal (0.01) to keep it clickable
        if (selectedAnnotationRef.current) {
          const prevAnnotation = selectedAnnotationRef.current as { FillColor?: unknown }
          if (prevAnnotation && Annotations) {
            prevAnnotation.FillColor = new Annotations.Color(255, 0, 0, 0.01)
            annotationManager.redrawAnnotation(prevAnnotation)
          }
        }
        selectedAnnotationRef.current = null
        
        // Notify parent component of deselection
        if (onAnnotationSelectedRef.current) {
          onAnnotationSelectedRef.current(null)
        }
        return
      }

      // Get the first selected annotation
      const selectedAnnotation = annotations[0]
      if (!selectedAnnotation) return

      // Only apply fill color to our annotations, but allow all annotations to be selected
      const isOurAnnotation = annotationsRef.current.has(selectedAnnotation)
      
      if (!isOurAnnotation) {
        // Not our annotation, don't apply fill but allow selection
        return
      }

      // Get annotation ID from Subject or _id property
      let annotationId: string | null = null
      if (selectedAnnotation && typeof selectedAnnotation === 'object') {
        const ann = selectedAnnotation as { Subject?: string; _id?: string }
        annotationId = ann.Subject || ann._id || null
      }
      
      // Notify parent component of selection
      if (onAnnotationSelectedRef.current) {
        onAnnotationSelectedRef.current(annotationId)
      }

      // Reset previous annotation fill if different (back to minimal 0.01 to keep it clickable)
      if (selectedAnnotationRef.current && selectedAnnotationRef.current !== selectedAnnotation) {
        const prevAnnotation = selectedAnnotationRef.current as { FillColor?: unknown }
        if (prevAnnotation && Annotations) {
          prevAnnotation.FillColor = new Annotations.Color(255, 0, 0, 0.01)
          annotationManager.redrawAnnotation(prevAnnotation)
        }
      }

      // Set semi-transparent fill for selected annotation
      const annotation = selectedAnnotation as { FillColor?: unknown }
      if (annotation && Annotations) {
        annotation.FillColor = new Annotations.Color(255, 0, 0, 0.3) // Semi-transparent red
        annotationManager.redrawAnnotation(annotation)
        selectedAnnotationRef.current = selectedAnnotation
      }
    }

    // Add event listener for annotationSelected event
    annotationManager.addEventListener('annotationSelected', handleAnnotationSelected)

    // Cleanup: remove event listener
    return () => {
      if (annotationManager.removeEventListener) {
        annotationManager.removeEventListener('annotationSelected', handleAnnotationSelected)
      }
    }
  }, [isReady])

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

    // Clear annotations when loading a new document
    annotationsRef.current.clear()
    selectedAnnotationRef.current = null

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

