import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import WebViewer from '@pdftron/webviewer'
import { API_BASE_URL as DEFAULT_API_BASE_URL } from '../../utils/apiConfig'
import { type AnnotatedPDFViewerRef } from './types'
import {
  useDocument,
  useTextAnnotations,
  useImageAnnotations,
  useAnnotationSelection,
  useAnnotationNavigation,
  useCriticalNavigation,
  type TextAnnotationData,
  type ImageAnnotationData,
  type ViewMode,
} from './hooks'
import { isCriticalClassification, INITIAL_SELECTION_DELAY } from './utils'
import { ReviewSidebar } from './components/ReviewSidebar'

export const Route = createFileRoute('/reviewer/review')({
  component: ReviewComponent,
  validateSearch: (search: Record<string, unknown>) => ({
    docid: (search.docid as string) || null,
  }),
})

interface WebViewerInstance {
  Core: {
    documentViewer: {
      loadDocument: (url: string, options?: { filename?: string }) => void
      addEventListener: (event: string, callback: () => void) => void
      removeEventListener?: (event: string, callback: () => void) => void
      getDocument?: () => {
        getPageInfo?: (pageNum: number) => { width: number; height: number } | null
      } | null
      setCurrentPage?: (pageNumber: number, isSmoothScroll?: boolean) => void
      getCurrentPage?: () => number
    }
    annotationManager?: {
      addAnnotation: (annotation: unknown) => void
      redrawAnnotation: (annotation: unknown) => void
      addEventListener: (event: string, callback: (annotations: unknown[], action?: string) => void) => void
      removeEventListener?: (event: string, callback: (annotations: unknown[], action?: string) => void) => void
      deselectAllAnnotations: () => void
      selectAnnotation?: (annotation: unknown) => void
      setSelectedAnnotations?: (annotations: unknown[]) => void
      bringAnnotationToFront?: (annotation: unknown) => void
      getAnnotationsList?: () => unknown[]
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
      }) => unknown
      Color: new (r: number, g: number, b: number, a: number) => unknown
    }
  }
  UI: {
    dispose: () => void
    ready?: () => Promise<void>
  }
}

const REFERENCE_PAGE_WIDTH = 1758
const REFERENCE_PAGE_HEIGHT = 2275
const ANNOTATION_PADDING = 5
const MOUSE_MOVE_THRESHOLD = 5
const CLICK_TIME_THRESHOLD = 300
const ANNOTATION_ADD_DELAY = 300
const DOCUMENT_LOAD_TIMEOUT = 30000

const WEBVIEWER_DISABLED_ELEMENTS = [
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
]

const addAnnotationToViewer = (
  instance: WebViewerInstance,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  pageNumber?: number,
  id?: string
) => {
  const { annotationManager, Annotations, documentViewer } = instance.Core
  if (!annotationManager || !Annotations) return

  const targetPage = pageNumber || 1
  let actualPageWidth = REFERENCE_PAGE_WIDTH
  let actualPageHeight = REFERENCE_PAGE_HEIGHT

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

  const scaleX = actualPageWidth / REFERENCE_PAGE_WIDTH
  const scaleY = actualPageHeight / REFERENCE_PAGE_HEIGHT

  const x = (Math.min(startX, endX) - ANNOTATION_PADDING) * scaleX
  const y = (Math.min(startY, endY) - ANNOTATION_PADDING) * scaleY
  const width = (Math.abs(endX - startX) + 2 * ANNOTATION_PADDING) * scaleX
  const height = (Math.abs(endY - startY) + 2 * ANNOTATION_PADDING) * scaleY

  const rect = new Annotations.RectangleAnnotation({
    X: x,
    Y: y,
    Width: width,
    Height: height,
    PageNumber: targetPage,
    StrokeColor: new Annotations.Color(192, 192, 192, 1),
    FillColor: new Annotations.Color(255, 0, 0, 0.01),
    ...(id ? { Subject: id } : {}),
  })

  if (rect && typeof rect === 'object') {
    const ann = rect as {
      Locked?: boolean
      NoSelect?: boolean
      NoMove?: boolean
      NoResize?: boolean
      NoDelete?: boolean
      ReadOnly?: boolean
    }
    ann.Locked = false
    ann.NoSelect = false
    ann.NoMove = true
    ann.NoResize = true
    ann.NoDelete = true
    ann.ReadOnly = false
  }

  annotationManager.addAnnotation(rect)

  try {
    if (annotationManager.bringAnnotationToFront) {
      annotationManager.bringAnnotationToFront(rect)
    }
    if (rect && typeof rect === 'object') {
      const ann = rect as { bringToFront?: () => void }
      if (typeof ann.bringToFront === 'function') {
        ann.bringToFront()
      }
    }
  } catch (err) {
    console.debug('Could not bring annotation to front:', err)
  }

  annotationManager.redrawAnnotation(rect)
  return rect
}

const getAnnotationId = (annotation: unknown): string | null => {
  if (annotation && typeof annotation === 'object') {
    const ann = annotation as { Subject?: string; _id?: string }
    return ann.Subject || ann._id || null
  }
  return null
}

function ReviewComponent() {
  const { docid } = Route.useSearch()
  const navigate = useNavigate()
  const [viewMode, setViewMode] = useState<ViewMode>('text')
  const [currentBoxIndex, setCurrentBoxIndex] = useState<number>(-1)
  const initializedRef = useRef<Set<string>>(new Set())

  // PDFViewer state and refs
  const viewerRef = useRef<HTMLDivElement>(null)
  const webViewerInstance = useRef<WebViewerInstance | null>(null)
  const isInitializing = useRef(false)
  const [isReady, setIsReady] = useState(false)
  const [isDocumentLoaded, setIsDocumentLoaded] = useState(false)
  const annotationsRef = useRef<Set<unknown>>(new Set())
  const annotationsByIdRef = useRef<Map<string, unknown>>(new Map())
  const selectedAnnotationRef = useRef<unknown | null>(null)
  const mouseDownRef = useRef<{ x: number; y: number; time: number } | null>(null)
  const isSelectingTextRef = useRef(false)
  const pendingAnnotationSelectionRef = useRef<unknown[] | null>(null)
  const previousDocumentRef = useRef<string | null>(null)
  const loadedDocumentRef = useRef<string | null>(null)
  const onAnnotationSelectedRef = useRef<((id: string | null) => void) | null>(null)

  // Data hooks
  const { document, isLoading, handlePDFLoadComplete } = useDocument(docid)
  const { textAnnotations, allBoundingBoxData } = useTextAnnotations(docid)
  const { allImageAnnotations, allImageAnnotationsData } = useImageAnnotations(docid)

  // Filter annotations based on view mode
  const currentAnnotations = useMemo(
    () => (viewMode === 'text' ? textAnnotations : allImageAnnotations),
    [viewMode, textAnnotations, allImageAnnotations]
  )

  // Helper to update annotation visibility
  const updateAnnotationVisibility = useCallback(
    (hidden: boolean, ids?: Set<string>) => {
      if (!webViewerInstance.current) return
      const { annotationManager } = webViewerInstance.current.Core
      if (!annotationManager) return

      try {
        annotationsRef.current.forEach((annotation) => {
          try {
            if (annotation && typeof annotation === 'object') {
              const ann = annotation as { Hidden?: boolean; Subject?: string }
              if (!ids || (ann.Subject && ids.has(ann.Subject))) {
                ann.Hidden = hidden
                annotationManager.redrawAnnotation(annotation)
              }
            }
          } catch (err) {
            console.error(`Error ${hidden ? 'hiding' : 'showing'} annotation:`, err)
          }
        })
      } catch (err) {
        console.error(`Error ${hidden ? 'hiding' : 'showing'} annotations:`, err)
      }
    },
    []
  )

  // Create pdfViewerRef with methods
  const pdfViewerRef = useRef<AnnotatedPDFViewerRef>({
    selectAnnotationById: (annotationId: string) => {
      if (!webViewerInstance.current) return
      const { annotationManager } = webViewerInstance.current.Core
      if (!annotationManager) return

      const annotation = annotationsByIdRef.current.get(annotationId)
      if (!annotation) {
        console.warn('Annotation not found:', annotationId)
        return
      }

      try {
        // Deselect all first
        annotationManager.deselectAllAnnotations()

        // Use requestAnimationFrame for smoother transition
        requestAnimationFrame(() => {
          if (!annotationManager || !webViewerInstance.current) return

          // Select the annotation first
          if (annotationManager.setSelectedAnnotations) {
            annotationManager.setSelectedAnnotations([annotation])
          } else if (annotationManager.selectAnnotation) {
            annotationManager.selectAnnotation(annotation)
          } else if (annotationManager.bringAnnotationToFront) {
            annotationManager.bringAnnotationToFront(annotation)
          }

          annotationManager.redrawAnnotation(annotation)

          // Jump to annotation - this handles smooth scrolling to both page and position
          // jumpToAnnotation automatically scrolls to the correct page and position smoothly
          if (annotationManager.jumpToAnnotation) {
            annotationManager.jumpToAnnotation(annotation)
          }
        })
      } catch (err) {
        console.error('Error selecting annotation:', err)
      }
    },
    scrollToPage: (pageNumber: number) => {
      if (!webViewerInstance.current) return
      const { documentViewer } = webViewerInstance.current.Core
      if (!documentViewer?.setCurrentPage) return
      try {
        documentViewer.setCurrentPage(pageNumber, true)
      } catch (err) {
        console.error('Error scrolling to page:', err)
      }
    },
    deselectAnnotations: () => {
      if (!webViewerInstance.current) return
      const { annotationManager, Annotations } = webViewerInstance.current.Core
      if (!annotationManager || !Annotations) return

      try {
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
    },
    clearAnnotations: () => {
      if (!webViewerInstance.current) return
      const { annotationManager } = webViewerInstance.current.Core
      if (!annotationManager) return

      try {
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
        annotationsByIdRef.current.clear()
        selectedAnnotationRef.current = null
        annotationManager.deselectAllAnnotations()
      } catch (err) {
        console.error('Error clearing annotations:', err)
      }
    },
    hideAllAnnotations: () => updateAnnotationVisibility(true),
    showAllAnnotations: () => updateAnnotationVisibility(false),
    hideAnnotationsByIds: (ids: Set<string>) => updateAnnotationVisibility(true, ids),
    showAnnotationsByIds: (ids: Set<string>) => updateAnnotationVisibility(false, ids),
  } as AnnotatedPDFViewerRef)

  // Annotation selection
  const {
    selectedAnnotationId,
    selectedImageAnnotationId,
    handleAnnotationSelected,
    clearSelection,
  } = useAnnotationSelection(viewMode, pdfViewerRef)

  // Handle annotation selection with view mode validation
  const handleAnnotationSelectedCallback = useCallback(
    (id: string | null) => {
      if (!id) {
        handleAnnotationSelected(null)
        return
      }
      const isImageAnnotation = id.startsWith('img-')
      const shouldSelect =
        (viewMode === 'text' && !isImageAnnotation) || (viewMode === 'image' && isImageAnnotation)
      handleAnnotationSelected(shouldSelect ? id : null)
    },
    [viewMode, handleAnnotationSelected]
  )

  useEffect(() => {
    onAnnotationSelectedRef.current = handleAnnotationSelectedCallback
  }, [handleAnnotationSelectedCallback])

  // Initialize WebViewer
  const PDFTRON_LICENSE_KEY = import.meta.env.VITE_PDFTRON_LICENSE_KEY || ''

  useEffect(() => {
    if (isInitializing.current || webViewerInstance.current || !viewerRef.current) return

    isInitializing.current = true
    const viewerElement = viewerRef.current
    viewerElement.innerHTML = ''

    WebViewer(
      {
        path: '/webviewer/lib',
        licenseKey: PDFTRON_LICENSE_KEY,
        disabledElements: WEBVIEWER_DISABLED_ELEMENTS,
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
        webViewerInstance.current = instance as unknown as WebViewerInstance
        instance.UI.setModularHeaders([])

        const { UI } = instance as WebViewerInstance
        if (UI?.ready) {
          UI.ready().then(() => {
            const style = window.document.createElement('style')
            style.textContent = `
              [data-element="header"] > *:not([data-element="zoomControls"]):not([class*="Zoom"]) {
                display: none !important;
              }
              [data-element="header"] [data-element="menuButton"],
              [data-element="header"] [data-element="toolsHeader"],
              [data-element="header"] [data-element="toolsHeaderButton"] {
                display: none !important;
              }
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
            window.document.head.appendChild(style)
            isInitializing.current = false
            setIsReady(true)
          })
        } else {
          setTimeout(() => {
            isInitializing.current = false
            setIsReady(true)
          }, 1000)
        }
      })
      .catch((err) => {
        console.error('Failed to initialize WebViewer:', err)
        isInitializing.current = false
      })

    return () => {
      if (webViewerInstance.current?.UI) {
        try {
          webViewerInstance.current.UI.dispose()
        } catch (err) {
          console.error('Error disposing WebViewer:', err)
        }
        webViewerInstance.current = null
      }
      viewerElement.innerHTML = ''
      isInitializing.current = false
    }
  }, [PDFTRON_LICENSE_KEY])

  // Set up mouse event listeners to detect text selection
  useEffect(() => {
    if (!webViewerInstance.current || !isReady || !viewerRef.current) return

    const viewerElement = viewerRef.current

    const handleMouseDown = (e: MouseEvent) => {
      mouseDownRef.current = { x: e.clientX, y: e.clientY, time: Date.now() }
      isSelectingTextRef.current = false
      pendingAnnotationSelectionRef.current = null
    }

    const handleMouseMove = (e: MouseEvent) => {
      if (!mouseDownRef.current) return

      const dx = Math.abs(e.clientX - mouseDownRef.current.x)
      const dy = Math.abs(e.clientY - mouseDownRef.current.y)
      const distance = Math.sqrt(dx * dx + dy * dy)

      if (distance > MOUSE_MOVE_THRESHOLD) {
        isSelectingTextRef.current = true
        if (pendingAnnotationSelectionRef.current && webViewerInstance.current) {
          webViewerInstance.current.Core.annotationManager?.deselectAllAnnotations()
          pendingAnnotationSelectionRef.current = null
        }
      }
    }

    const handleMouseUp = () => {
      if (mouseDownRef.current) {
        const timeDiff = Date.now() - mouseDownRef.current.time
        if (timeDiff > CLICK_TIME_THRESHOLD || isSelectingTextRef.current) {
          setTimeout(() => {
            isSelectingTextRef.current = false
          }, 200)
        } else {
          isSelectingTextRef.current = false
        }
      }
      mouseDownRef.current = null
    }

    viewerElement.addEventListener('mousedown', handleMouseDown)
    viewerElement.addEventListener('mousemove', handleMouseMove)
    viewerElement.addEventListener('mouseup', handleMouseUp)

    return () => {
      viewerElement.removeEventListener('mousedown', handleMouseDown)
      viewerElement.removeEventListener('mousemove', handleMouseMove)
      viewerElement.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isReady])

  // Set up annotation selection event listener
  useEffect(() => {
    if (!webViewerInstance.current || !isReady) return

    const { annotationManager, Annotations } = webViewerInstance.current.Core
    if (!annotationManager || !Annotations) return

    const processAnnotationSelection = (annotations: unknown[]) => {
      if (annotations.length === 0) {
        if (selectedAnnotationRef.current) {
          const prevAnnotation = selectedAnnotationRef.current as { FillColor?: unknown }
          prevAnnotation.FillColor = new Annotations.Color(255, 0, 0, 0.01)
          annotationManager.redrawAnnotation(prevAnnotation)
        }
        selectedAnnotationRef.current = null
        onAnnotationSelectedRef.current?.(null)
        return
      }

      const selectedAnnotation = annotations[0]
      if (!selectedAnnotation || !annotationsRef.current.has(selectedAnnotation)) return

      const annotationId = getAnnotationId(selectedAnnotation)
      onAnnotationSelectedRef.current?.(annotationId)

      if (selectedAnnotationRef.current && selectedAnnotationRef.current !== selectedAnnotation) {
        const prevAnnotation = selectedAnnotationRef.current as { FillColor?: unknown }
        prevAnnotation.FillColor = new Annotations.Color(255, 0, 0, 0.01)
        annotationManager.redrawAnnotation(prevAnnotation)
      }

      const annotation = selectedAnnotation as { FillColor?: unknown }
      annotation.FillColor = new Annotations.Color(255, 0, 0, 0.3)
      annotationManager.redrawAnnotation(annotation)
      selectedAnnotationRef.current = selectedAnnotation
    }

    const handleAnnotationSelected = (annotations: unknown[], action?: string) => {
      if (isSelectingTextRef.current) {
        setTimeout(() => annotationManager.deselectAllAnnotations(), 0)
        return
      }

      if (annotations.length > 0 && mouseDownRef.current) {
        const timeSinceMouseDown = Date.now() - mouseDownRef.current.time
        if (timeSinceMouseDown < 150) {
          pendingAnnotationSelectionRef.current = annotations
          setTimeout(() => {
            if (isSelectingTextRef.current) {
              annotationManager.deselectAllAnnotations()
              pendingAnnotationSelectionRef.current = null
              return
            }
            if (pendingAnnotationSelectionRef.current === annotations) {
              processAnnotationSelection(annotations)
              if (action === 'selected' && annotations.length > 0 && annotationManager.jumpToAnnotation) {
                annotationManager.jumpToAnnotation(annotations[0])
              }
            }
            pendingAnnotationSelectionRef.current = null
          }, 150)
          return
        }
      }

      processAnnotationSelection(annotations)

      if (action === 'selected' && annotations.length > 0 && annotationManager.jumpToAnnotation) {
        annotationManager.jumpToAnnotation(annotations[0])
      }
    }

    annotationManager.addEventListener('annotationSelected', handleAnnotationSelected)

    return () => {
      annotationManager.removeEventListener?.('annotationSelected', handleAnnotationSelected)
    }
  }, [isReady])

  // Track document changes to reset loaded state
  useEffect(() => {
    const currentDocumentKey = docid || null
    if (currentDocumentKey !== previousDocumentRef.current) {
      setIsDocumentLoaded(false)
      loadedDocumentRef.current = null
      previousDocumentRef.current = currentDocumentKey
      annotationsRef.current.clear()
      annotationsByIdRef.current.clear()
      selectedAnnotationRef.current = null
    }
  }, [docid])

  // Load document when documentId changes or when WebViewer becomes ready
  useEffect(() => {
    if (!webViewerInstance.current || !isReady || !docid) return

    // Skip if we've already loaded this document
    if (docid === loadedDocumentRef.current) return

    const loadDocument = async () => {
      let url: string | null = null

      try {
        const response = await fetch(`${DEFAULT_API_BASE_URL}/view/document/${docid}`)
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ detail: 'Failed to fetch document' }))
          throw new Error(errorData.detail || `HTTP error! status: ${response.status}`)
        }

        const blob = await response.blob()
        url = URL.createObjectURL(blob)
        const documentFilename = document?.filename || `document-${docid}.pdf`

        if (!webViewerInstance.current) {
          throw new Error('WebViewer instance is not available')
        }

        const { documentViewer } = webViewerInstance.current.Core
        if (!documentViewer) {
          throw new Error('Document viewer is not ready')
        }

        let timeoutId: number | null = null
        let isComplete = false

        const handleDocumentLoaded = () => {
          if (isComplete) return
          isComplete = true

          if (timeoutId) {
            clearTimeout(timeoutId)
            timeoutId = null
          }
          documentViewer.removeEventListener?.('documentLoaded', handleDocumentLoaded)

          if (url?.startsWith('blob:')) {
            URL.revokeObjectURL(url)
          }
          loadedDocumentRef.current = docid
          setIsDocumentLoaded(true)
          handlePDFLoadComplete()
        }

        timeoutId = setTimeout(() => {
          handleDocumentLoaded()
        }, DOCUMENT_LOAD_TIMEOUT)

        documentViewer.addEventListener('documentLoaded', handleDocumentLoaded)
        documentViewer.loadDocument(url, { filename: documentFilename })
      } catch (err) {
        if (url?.startsWith('blob:')) {
          URL.revokeObjectURL(url)
        }
        console.error('Error loading document:', err)
        setIsDocumentLoaded(false)
        loadedDocumentRef.current = null
        handlePDFLoadComplete()
      }
    }

    loadDocument()
  }, [docid, isReady, document?.filename, handlePDFLoadComplete])

  // Add annotations when document is loaded or annotations change
  useEffect(() => {
    if (!isDocumentLoaded || !webViewerInstance.current) return

    pdfViewerRef.current?.clearAnnotations()

    if (currentAnnotations.length === 0) return

    const timeoutId = setTimeout(() => {
      if (!webViewerInstance.current) return

      currentAnnotations.forEach((annotation) => {
        const annotationObj = addAnnotationToViewer(
          webViewerInstance.current!,
          annotation.startX,
          annotation.startY,
          annotation.endX,
          annotation.endY,
          annotation.pageNumber,
          annotation.id
        )

        if (annotationObj && annotation.id) {
          annotationsRef.current.add(annotationObj)
          if (typeof annotationObj === 'object') {
            const ann = annotationObj as { _id?: string; Subject?: string }
            ann._id = annotation.id
            ann.Subject = annotation.id
            annotationsByIdRef.current.set(annotation.id, annotationObj)
          }
        }
      })
    }, ANNOTATION_ADD_DELAY)

    return () => clearTimeout(timeoutId)
  }, [isDocumentLoaded, currentAnnotations])

  const selectAnnotationById = useCallback((id: string) => {
    pdfViewerRef.current?.selectAnnotationById(id)
  }, [])

  // Update sidebar data based on viewMode
  const [boundingBoxData, setBoundingBoxData] = useState<Map<string, TextAnnotationData>>(new Map())
  const [imageAnnotationsData, setImageAnnotationsData] = useState<Map<string, ImageAnnotationData>>(new Map())

  useEffect(() => {
    if (viewMode === 'text') {
      const textDataMap = new Map<string, TextAnnotationData>()
      textAnnotations.forEach((annotation) => {
        const data = allBoundingBoxData.get(annotation.id || '')
        if (data) textDataMap.set(annotation.id || '', data)
      })
      setBoundingBoxData(textDataMap)
      setImageAnnotationsData(new Map())
    } else {
      const imageDataMap = new Map<string, ImageAnnotationData>()
      allImageAnnotations.forEach((annotation) => {
        const data = allImageAnnotationsData.get(annotation.id || '')
        if (data) imageDataMap.set(annotation.id || '', data)
      })
      setImageAnnotationsData(imageDataMap)
      setBoundingBoxData(new Map())
    }
    clearSelection()
    setCurrentBoxIndex(-1)
  }, [viewMode, textAnnotations, allBoundingBoxData, allImageAnnotations, allImageAnnotationsData, clearSelection])

  // Calculate critical annotations
  const criticalAnnotationIndices = useMemo(() => {
    return currentAnnotations
      .map((annotation, index) => ({ annotation, index }))
      .filter(({ annotation }) => {
        if (!annotation.id) return false
        const data =
          viewMode === 'text'
            ? allBoundingBoxData.get(annotation.id)
            : allImageAnnotationsData.get(annotation.id)
        return data ? isCriticalClassification(data.classification) : false
      })
      .map(({ index }) => index)
  }, [currentAnnotations, viewMode, allBoundingBoxData, allImageAnnotationsData])

  // Navigation
  const { handlePrevious, handleNext } = useAnnotationNavigation(
    currentAnnotations,
    currentBoxIndex,
    setCurrentBoxIndex,
    selectAnnotationById
  )

  const { handlePreviousCritical, handleNextCritical } = useCriticalNavigation(
    criticalAnnotationIndices,
    currentBoxIndex,
    currentAnnotations,
    setCurrentBoxIndex,
    selectAnnotationById
  )

  // Initialize first annotation on load
  useEffect(() => {
    const key = `${docid}-${viewMode}-${currentAnnotations.length}`
    if (currentAnnotations.length > 0) {
      if (
        !initializedRef.current.has(key) ||
        currentBoxIndex < 0 ||
        currentBoxIndex >= currentAnnotations.length
      ) {
        initializedRef.current.add(key)
        setCurrentBoxIndex(0)
        const firstBox = currentAnnotations[0]
        if (firstBox?.id) {
          setTimeout(() => {
            if (pdfViewerRef.current && firstBox.id) {
              selectAnnotationById(firstBox.id)
            }
          }, INITIAL_SELECTION_DELAY)
        }
      }
    } else {
      initializedRef.current.delete(key)
      setCurrentBoxIndex(-1)
      clearSelection()
    }
  }, [currentAnnotations, docid, viewMode, currentBoxIndex, clearSelection, selectAnnotationById])

  // Sync index with selection
  useEffect(() => {
    const selectedId = viewMode === 'text' ? selectedAnnotationId : selectedImageAnnotationId
    if (selectedId && currentAnnotations.length > 0) {
      const index = currentAnnotations.findIndex((box) => box.id === selectedId)
      if (index >= 0 && index !== currentBoxIndex) {
        setCurrentBoxIndex(index)
      }
    }
  }, [selectedAnnotationId, selectedImageAnnotationId, currentAnnotations, currentBoxIndex, viewMode])

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
    <div className="fixed top-0 left-0 right-0 bottom-0 flex flex-col overflow-hidden bg-gray-50">
      <div className="flex-1 flex overflow-hidden">
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
            <div ref={viewerRef} className="w-full h-full" />
          </div>
        </div>

        <ReviewSidebar
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          currentIndex={currentBoxIndex}
          totalCount={currentAnnotations.length}
          selectedAnnotationId={selectedAnnotationId}
          selectedImageAnnotationId={selectedImageAnnotationId}
          boundingBoxData={boundingBoxData}
          imageAnnotationsData={imageAnnotationsData}
        />
      </div>

      <div className="h-16 bg-white border-t border-gray-200 flex items-center justify-between px-6">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-semibold">{document?.filename || 'Document Viewer'}</h2>
          <p className="text-sm text-gray-500">File ID: {document?.file_id || docid || ''}</p>
          {currentAnnotations.length > 0 && currentBoxIndex >= 0 && (
            <p className="text-sm text-gray-500">
              {viewMode === 'text' ? 'Text' : 'Image'} {currentBoxIndex + 1}/{currentAnnotations.length}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handlePrevious}
            disabled={currentAnnotations.length === 0 || isLoading}
            className="px-4 py-2 text-sm font-medium rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous {viewMode === 'text' ? 'Text' : 'Image'}
          </button>
          <button
            onClick={handleNext}
            disabled={currentAnnotations.length === 0 || isLoading}
            className="px-4 py-2 text-sm font-medium rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next {viewMode === 'text' ? 'Text' : 'Image'}
          </button>
          <button
            onClick={handlePreviousCritical}
            disabled={criticalAnnotationIndices.length === 0 || isLoading}
            className="px-4 py-2 text-sm font-medium rounded-md bg-red-100 text-red-700 hover:bg-red-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous Critical
          </button>
          <button
            onClick={handleNextCritical}
            disabled={criticalAnnotationIndices.length === 0 || isLoading}
            className="px-4 py-2 text-sm font-medium rounded-md bg-red-100 text-red-700 hover:bg-red-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next Critical
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
