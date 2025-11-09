import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState, useEffect, useRef, useMemo } from 'react'
import { type RectangleAnnotation, type AnnotatedPDFViewerRef } from '../pdftest/components/AnnotatedPDFViewer'
import { apiService } from '../upload/api'
import type { Document } from '../upload/types'
import { ReviewSidebar } from './components/ReviewSidebar'
import { BottomNavigationBar } from './components/BottomNavigationBar'
import { PDFViewerContainer } from './components/PDFViewerContainer'

export const Route = createFileRoute('/reviewer/review')({
  component: ReviewComponent,
  validateSearch: (search: Record<string, unknown>) => {
    return {
      docid: (search.docid as string) || null,
    }
  },
})

interface ImageAnnotationData {
  page: number
  image_index: number
  xref: number
  extension: string
  size_bytes: number
  page_width: number
  page_height: number
  safe_search: {
    adult: string
    spoof: string
    medical: string
    violence: string
    racy: string
  }
  classification?: string
}

function ReviewComponent() {
  const { docid } = Route.useSearch()
  const navigate = useNavigate()
  const [document, setDocument] = useState<Document | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [allBoundingBoxes, setAllBoundingBoxes] = useState<RectangleAnnotation[]>([])
  const [allBoundingBoxData, setAllBoundingBoxData] = useState<Map<string, {
    id: string
    text: string
    classification?: string
    confidence?: string | number
    explanation?: string
    type: string
  }>>(new Map())
  const [boundingBoxData, setBoundingBoxData] = useState<Map<string, {
    id: string
    text: string
    classification?: string
    confidence?: string | number
    explanation?: string
    type: string
  }>>(new Map())
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'image' | 'text'>('text')
  const [currentBoxIndex, setCurrentBoxIndex] = useState<number>(-1)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pdfViewerRef = useRef<AnnotatedPDFViewerRef>(null)
  const [allImageAnnotations, setAllImageAnnotations] = useState<RectangleAnnotation[]>([])
  const [allImageAnnotationsData, setAllImageAnnotationsData] = useState<Map<string, ImageAnnotationData>>(new Map())
  const [imageAnnotationsData, setImageAnnotationsData] = useState<Map<string, ImageAnnotationData>>(new Map())
  const [selectedImageAnnotationId, setSelectedImageAnnotationId] = useState<string | null>(null)
  const initializedRef = useRef<Set<string>>(new Set())


  useEffect(() => {
    console.log("selectedImageAnnotationId", selectedImageAnnotationId)
  }, [selectedImageAnnotationId])

  useEffect(() => {
    console.log("imageAnnotationsData", allImageAnnotationsData)
  }, [allImageAnnotationsData])
  
  // Fetch document
  useEffect(() => {
    if (!docid) {
      setIsLoading(false)
      return
    }

    // Clear any existing timeout when document changes
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }

    const fetchDocument = async () => {
      try {
        setIsLoading(true)
        const response = await apiService.getDocuments(100)
        const foundDoc = response.files.find((doc) => doc.file_id === docid)
        setDocument(foundDoc || null)
        // Keep loading true - will be set to false when PDF loads
      } catch (err) {
        console.error('Failed to fetch document:', err)
        setIsLoading(false)
      }
    }

    fetchDocument()
  }, [docid])

  // Fetch bounding boxes
  useEffect(() => {
    if (!docid) {
      setAllBoundingBoxes([])
      setAllBoundingBoxData(new Map())
      setBoundingBoxData(new Map())
      setSelectedAnnotationId(null)
      return
    }

    const fetchBoundingBoxes = async () => {
      try {
        const pages = await apiService.getDocumentBoundingBoxes(docid)
        const annotations: RectangleAnnotation[] = []
        const dataMap = new Map<string, {
          id: string
          text: string
          classification?: string
          confidence?: string | number
          explanation?: string
          type: string
        }>()

        pages.forEach((page) => {
          const pageNumber = page.page_number || 1
          page.bounding_boxes?.forEach((box, index) => {
            const vertices = box.bounding_box?.vertices || []
            if (vertices.length >= 2) {
              const xs = vertices.map((v) => v.x)
              const ys = vertices.map((v) => v.y)
              const boxId = box.id || `${pageNumber}-${index + 1}`
              annotations.push({
                startX: Math.min(...xs),
                startY: Math.min(...ys),
                endX: Math.max(...xs),
                endY: Math.max(...ys),
                pageNumber: pageNumber,
                id: boxId,
              })
              
              // Store full bounding box data
              dataMap.set(boxId, {
                id: boxId,
                text: box.text || '',
                classification: box.classification,
                confidence: box.confidence,
                explanation: box.explanation,
                type: box.type || 'block',
              })
            }
          })
        })

        setAllBoundingBoxes(annotations)
        setAllBoundingBoxData(dataMap)
      } catch (err) {
        console.error('Failed to fetch bounding boxes:', err)
        setAllBoundingBoxes([])
        setAllBoundingBoxData(new Map())
        setBoundingBoxData(new Map())
      }
    }

    fetchBoundingBoxes()
  }, [docid])

  // Fetch image annotations
  useEffect(() => {
    if (!docid) {
      setAllImageAnnotations([])
      setAllImageAnnotationsData(new Map())
      setImageAnnotationsData(new Map())
      setSelectedImageAnnotationId(null)
      return
    }

    const fetchImageAnnotations = async () => {
      try {
        const images = await apiService.getDocumentImages(docid)
        const annotations: RectangleAnnotation[] = []
        const dataMap = new Map<string, ImageAnnotationData>()

        images.forEach((image) => {
          const pageNumber = image.page || 1
          const bbox = image.bounding_box
          
          if (bbox && image.page_width > 0 && image.page_height > 0) {
            // Convert from page coordinate system to reference coordinate system (1758x2275)
            // The PDFViewer expects coordinates in this reference system
            const referenceWidth = 1758
            const referenceHeight = 2275
            
            // Convert coordinates
            const scaleX = referenceWidth / image.page_width
            const scaleY = referenceHeight / image.page_height
            
            // Convert bounding box coordinates
            // Note: PDF coordinates typically have (0,0) at bottom-left, but we'll use the values as-is
            // and let the PDFViewer handle coordinate system conversion
            const startX = bbox.x0 * scaleX
            const startY = bbox.y0 * scaleY
            const endX = bbox.x1 * scaleX
            const endY = bbox.y1 * scaleY
            
            const imageId = `img-${pageNumber}-${image.image_index}`
            
            annotations.push({
              startX: Math.min(startX, endX),
              startY: Math.min(startY, endY),
              endX: Math.max(startX, endX),
              endY: Math.max(startY, endY),
              pageNumber: pageNumber,
              id: imageId,
            })
            
            // Store full image annotation data
            dataMap.set(imageId, {
              page: pageNumber,
              image_index: image.image_index,
              xref: image.xref,
              extension: image.extension,
              size_bytes: image.size_bytes,
              page_width: image.page_width,
              page_height: image.page_height,
              safe_search: image.safe_search,
            })
          }
        })

        setAllImageAnnotations(annotations)
        setAllImageAnnotationsData(dataMap)
      } catch (err) {
        console.error('Failed to fetch image annotations:', err)
        setAllImageAnnotations([])
        setAllImageAnnotationsData(new Map())
        setImageAnnotationsData(new Map())
      }
    }

    fetchImageAnnotations()
  }, [docid])

  // Filter text annotations (always keep them in viewer, just hide/show)
  const textAnnotations = useMemo(() => {
    return allBoundingBoxes.filter((annotation) => {
      const data = allBoundingBoxData.get(annotation.id || '')
      return data && (data.type === 'block' || data.type === 'text' || !data.type || data.type !== 'image')
    })
  }, [allBoundingBoxes, allBoundingBoxData])

  // Update bounding boxes and data based on viewMode
  useEffect(() => {
    if (viewMode === 'text') {
      // Text mode: show annotation data in sidebar
      const textDataMap = new Map<string, {
        id: string
        text: string
        classification?: string
        confidence?: string | number
        explanation?: string
        type: string
      }>()
      textAnnotations.forEach((annotation) => {
        const data = allBoundingBoxData.get(annotation.id || '')
        if (data) {
          textDataMap.set(annotation.id || '', data)
        }
      })
      setBoundingBoxData(textDataMap)
      setImageAnnotationsData(new Map())
    } else {
      // Image mode: show image annotation data in sidebar
      const imageDataMap = new Map<string, ImageAnnotationData>()
      allImageAnnotations.forEach((annotation) => {
        const data = allImageAnnotationsData.get(annotation.id || '')
        if (data) {
          imageDataMap.set(annotation.id || '', data)
        }
      })
      setImageAnnotationsData(imageDataMap)
      setBoundingBoxData(new Map())
    }
    // Clear selection when switching modes
    setSelectedAnnotationId(null)
    setSelectedImageAnnotationId(null)
    setCurrentBoxIndex(-1)
  }, [viewMode, textAnnotations, allBoundingBoxData, allImageAnnotations, allImageAnnotationsData])

  // Hide/show annotations based on viewMode
  useEffect(() => {
    if (!pdfViewerRef.current) return

    // Get IDs for text and image annotations
    const textAnnotationIds = new Set(textAnnotations.map(a => a.id).filter((id): id is string => !!id))
    const imageAnnotationIds = new Set(allImageAnnotations.map(a => a.id).filter((id): id is string => !!id))

    // Use a delay to ensure annotations are added to the viewer first
    // (AnnotatedPDFViewer adds annotations with a 300ms delay)
    const timeoutId = setTimeout(() => {
      if (!pdfViewerRef.current) return

      if (viewMode === 'text') {
        // Show text annotations, hide image annotations
        if (pdfViewerRef.current.showAnnotationsByIds && textAnnotationIds.size > 0) {
          pdfViewerRef.current.showAnnotationsByIds(textAnnotationIds)
        }
        if (pdfViewerRef.current.hideAnnotationsByIds && imageAnnotationIds.size > 0) {
          pdfViewerRef.current.hideAnnotationsByIds(imageAnnotationIds)
        }
      } else {
        // Show image annotations, hide text annotations
        if (pdfViewerRef.current.showAnnotationsByIds && imageAnnotationIds.size > 0) {
          pdfViewerRef.current.showAnnotationsByIds(imageAnnotationIds)
        }
        if (pdfViewerRef.current.hideAnnotationsByIds && textAnnotationIds.size > 0) {
          pdfViewerRef.current.hideAnnotationsByIds(textAnnotationIds)
        }
      }
    }, 400) // Wait a bit longer than the annotation add delay (300ms)

    return () => clearTimeout(timeoutId)
  }, [viewMode, textAnnotations, allImageAnnotations])

  // Initially hide image annotations when they're first loaded (if in text mode)
  useEffect(() => {
    if (!pdfViewerRef.current || viewMode !== 'text' || allImageAnnotations.length === 0) return

    // Hide image annotations when they're first loaded
    const imageAnnotationIds = new Set(allImageAnnotations.map(a => a.id).filter((id): id is string => !!id))
    
    if (imageAnnotationIds.size > 0) {
      // Use a delay to ensure annotations are added to the viewer first
      const timeoutId = setTimeout(() => {
        if (pdfViewerRef.current?.hideAnnotationsByIds) {
          pdfViewerRef.current.hideAnnotationsByIds(imageAnnotationIds)
        }
      }, 400)

      return () => clearTimeout(timeoutId)
    }
  }, [allImageAnnotations, viewMode])

  // Combine all annotations - both text and image - to pass to viewer
  // The viewer will show/hide them based on viewMode
  const currentAnnotations = useMemo(() => {
    // Return both sets of annotations
    return [...textAnnotations, ...allImageAnnotations]
  }, [textAnnotations, allImageAnnotations])

  // Get current annotations list based on view mode for navigation
  const currentAnnotationsList = useMemo(() => {
    return viewMode === 'text' ? textAnnotations : allImageAnnotations
  }, [viewMode, textAnnotations, allImageAnnotations])

  // Get list of critical annotation indices
  const criticalAnnotationIndices = useMemo(() => {
    return currentAnnotationsList
      .map((annotation, index) => ({ annotation, index }))
      .filter(({ annotation }) => {
        if (!annotation.id) return false
        
        if (viewMode === 'text') {
          const data = allBoundingBoxData.get(annotation.id)
          if (!data) return false
          const classification = data.classification
          return (
            classification === 'Highly Sensitive' ||
            classification === 'Confidential' ||
            classification === 'Unsafe' ||
            classification === '' ||
            !classification
          )
        } else {
          // For image mode, check if classification exists and matches critical criteria
          const data = allImageAnnotationsData.get(annotation.id)
          if (!data) return false
          const classification = data.classification
          return (
            classification === 'Highly Sensitive' ||
            classification === 'Confidential' ||
            classification === 'Unsafe' ||
            classification === '' ||
            !classification
          )
        }
      })
      .map(({ index }) => index)
  }, [currentAnnotationsList, viewMode, allBoundingBoxData, allImageAnnotationsData])

  // Navigation helpers for bounding boxes
  const handlePrevious = () => {
    if (currentAnnotationsList.length === 0) return
    
    let newIndex: number
    if (currentBoxIndex <= 0) {
      // Wrap to last box
      newIndex = currentAnnotationsList.length - 1
    } else {
      newIndex = currentBoxIndex - 1
    }
    
    setCurrentBoxIndex(newIndex)
    const box = currentAnnotationsList[newIndex]
    if (box?.id && pdfViewerRef.current) {
      pdfViewerRef.current.selectAnnotationById(box.id)
      if (viewMode === 'text') {
        setSelectedAnnotationId(box.id)
        setSelectedImageAnnotationId(null)
      } else {
        setSelectedImageAnnotationId(box.id)
        setSelectedAnnotationId(null)
      }
    }
  }

  const handleNext = () => {
    if (currentAnnotationsList.length === 0) return
    
    let newIndex: number
    if (currentBoxIndex >= currentAnnotationsList.length - 1) {
      // Wrap to first box
      newIndex = 0
    } else {
      newIndex = currentBoxIndex + 1
    }
    
    setCurrentBoxIndex(newIndex)
    const box = currentAnnotationsList[newIndex]
    if (box?.id && pdfViewerRef.current) {
      pdfViewerRef.current.selectAnnotationById(box.id)
      if (viewMode === 'text') {
        setSelectedAnnotationId(box.id)
        setSelectedImageAnnotationId(null)
      } else {
        setSelectedImageAnnotationId(box.id)
        setSelectedAnnotationId(null)
      }
    }
  }

  // Navigation helpers for critical annotations
  const handlePreviousCritical = () => {
    if (criticalAnnotationIndices.length === 0) return
    
    // Find the current critical index position
    let currentCriticalIndex = criticalAnnotationIndices.findIndex(idx => idx === currentBoxIndex)
    
    // If current annotation is not critical, find the previous critical annotation
    if (currentCriticalIndex < 0) {
      // Find the last critical annotation before the current index
      const previousCritical = criticalAnnotationIndices
        .filter(idx => idx < currentBoxIndex)
        .sort((a, b) => b - a)[0]
      
      if (previousCritical !== undefined) {
        currentCriticalIndex = criticalAnnotationIndices.indexOf(previousCritical)
      } else {
        // No previous critical, wrap to last
        currentCriticalIndex = criticalAnnotationIndices.length
      }
    }
    
    let targetIndex: number
    if (currentCriticalIndex <= 0) {
      // Wrap to last critical annotation
      targetIndex = criticalAnnotationIndices[criticalAnnotationIndices.length - 1]
    } else {
      // Go to previous critical annotation
      targetIndex = criticalAnnotationIndices[currentCriticalIndex - 1]
    }
    
    setCurrentBoxIndex(targetIndex)
    const box = currentAnnotationsList[targetIndex]
    if (box?.id && pdfViewerRef.current) {
      pdfViewerRef.current.selectAnnotationById(box.id)
      if (viewMode === 'text') {
        setSelectedAnnotationId(box.id)
        setSelectedImageAnnotationId(null)
      } else {
        setSelectedImageAnnotationId(box.id)
        setSelectedAnnotationId(null)
      }
    }
  }

  const handleNextCritical = () => {
    if (criticalAnnotationIndices.length === 0) return
    
    // Find the current critical index position
    let currentCriticalIndex = criticalAnnotationIndices.findIndex(idx => idx === currentBoxIndex)
    
    // If current annotation is not critical, find the next critical annotation
    if (currentCriticalIndex < 0) {
      // Find the first critical annotation after the current index
      const nextCritical = criticalAnnotationIndices
        .filter(idx => idx > currentBoxIndex)
        .sort((a, b) => a - b)[0]
      
      if (nextCritical !== undefined) {
        currentCriticalIndex = criticalAnnotationIndices.indexOf(nextCritical)
      } else {
        // No next critical, wrap to first
        currentCriticalIndex = criticalAnnotationIndices.length - 1
      }
    }
    
    let targetIndex: number
    if (currentCriticalIndex < 0 || currentCriticalIndex >= criticalAnnotationIndices.length - 1) {
      // Wrap to first critical annotation
      targetIndex = criticalAnnotationIndices[0]
    } else {
      // Go to next critical annotation
      targetIndex = criticalAnnotationIndices[currentCriticalIndex + 1]
    }
    
    setCurrentBoxIndex(targetIndex)
    const box = currentAnnotationsList[targetIndex]
    if (box?.id && pdfViewerRef.current) {
      pdfViewerRef.current.selectAnnotationById(box.id)
      if (viewMode === 'text') {
        setSelectedAnnotationId(box.id)
        setSelectedImageAnnotationId(null)
      } else {
        setSelectedImageAnnotationId(box.id)
        setSelectedAnnotationId(null)
      }
    }
  }

  // Reset box index when annotations change or document changes
  useEffect(() => {
    const key = `${docid}-${viewMode}-${currentAnnotationsList.length}`
    if (currentAnnotationsList.length > 0) {
      // If no box is selected or current index is invalid, select first box
      if (!initializedRef.current.has(key) || currentBoxIndex < 0 || currentBoxIndex >= currentAnnotationsList.length) {
        initializedRef.current.add(key)
        setCurrentBoxIndex(0)
        const firstBox = currentAnnotationsList[0]
        if (firstBox && firstBox.id) {
          // Wait for PDF to load before selecting
          setTimeout(() => {
            if (pdfViewerRef.current && firstBox.id) {
              pdfViewerRef.current.selectAnnotationById(firstBox.id)
              if (viewMode === 'text') {
                setSelectedAnnotationId(firstBox.id)
                setSelectedImageAnnotationId(null)
              } else {
                setSelectedImageAnnotationId(firstBox.id)
                console.log("selectedImageAnnotationId", firstBox.id)
                setSelectedAnnotationId(null)
              }
            }
          }, 1500)
        }
      }
    } else {
      initializedRef.current.delete(key)
      setCurrentBoxIndex(-1)
      setSelectedAnnotationId(null)
      setSelectedImageAnnotationId(null)
    }
  }, [currentAnnotationsList, docid, viewMode, currentBoxIndex])

  // Update current index when annotation is selected manually
  useEffect(() => {
    const selectedId = viewMode === 'text' ? selectedAnnotationId : selectedImageAnnotationId
    if (selectedId && currentAnnotationsList.length > 0) {
      const index = currentAnnotationsList.findIndex(box => box.id === selectedId)
      if (index >= 0 && index !== currentBoxIndex) {
        setCurrentBoxIndex(index)
      }
    }
  }, [selectedAnnotationId, selectedImageAnnotationId, currentAnnotationsList, currentBoxIndex, viewMode])

  const handlePDFLoadComplete = () => {
    // Keep loading visible for 3 seconds after PDF is fully loaded
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => {
      setIsLoading(false)
      timeoutRef.current = null
    }, 3000)
  }

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

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

  const handleAnnotationSelected = (id: string | null) => {
    if (!id) {
      setSelectedAnnotationId(null)
      setSelectedImageAnnotationId(null)
      return
    }

    // Check if it's an image annotation (starts with "img-")
    const isImageAnnotation = id.startsWith('img-')

    if (viewMode === 'text') {
      // In text mode, only allow selecting text annotations
      if (!isImageAnnotation) {
        setSelectedAnnotationId(id)
        setSelectedImageAnnotationId(null)
      } else {
        // Ignore image annotation selection in text mode
        setSelectedAnnotationId(null)
        setSelectedImageAnnotationId(null)
      }
    } else {
      // In image mode, only allow selecting image annotations
      if (isImageAnnotation) {
        setSelectedImageAnnotationId(id)
        setSelectedAnnotationId(null)
      } else {
        // Ignore text annotation selection in image mode
        setSelectedAnnotationId(null)
        setSelectedImageAnnotationId(null)
      }
    }
  }

  return (
    <div className="fixed top-0 left-0 right-0 bottom-0 flex flex-col overflow-hidden bg-gray-50">
      <div className="flex-1 flex overflow-hidden">
        <PDFViewerContainer
          document={document}
          documentId={docid}
          isLoading={isLoading}
          pdfViewerRef={pdfViewerRef as React.RefObject<AnnotatedPDFViewerRef>}
          annotations={currentAnnotations}
          onLoadComplete={handlePDFLoadComplete}
          onAnnotationSelected={handleAnnotationSelected}
          viewMode={viewMode}
          onNavigate={(to) => navigate({ to })}
        />

        <ReviewSidebar
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          currentIndex={currentBoxIndex}
          totalCount={currentAnnotationsList.length}
          selectedAnnotationId={selectedAnnotationId}
          selectedImageAnnotationId={selectedImageAnnotationId}
          boundingBoxData={boundingBoxData}
          imageAnnotationsData={imageAnnotationsData}
        />
      </div>

      <BottomNavigationBar
        documentFilename={document?.filename}
        documentId={document?.file_id || docid || undefined}
        currentIndex={currentBoxIndex}
        totalCount={currentAnnotationsList.length}
        viewMode={viewMode}
        onPrevious={handlePrevious}
        onNext={handleNext}
        onPreviousCritical={handlePreviousCritical}
        onNextCritical={handleNextCritical}
        hasCriticalAnnotations={criticalAnnotationIndices.length > 0}
        isLoading={isLoading}
      />
    </div>
  )
}
