import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState, useEffect, useRef, useMemo } from 'react'
import { AnnotatedPDFViewer, type RectangleAnnotation, type AnnotatedPDFViewerRef } from '../pdftest/components/AnnotatedPDFViewer'
import { apiService } from '../upload/api'
import type { Document } from '../upload/types'

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
}

function ReviewComponent() {
  const { docid } = Route.useSearch()
  const navigate = useNavigate()
  const [document, setDocument] = useState<Document | null>(null)
  const [allDocuments, setAllDocuments] = useState<Document[]>([])
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
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pdfViewerRef = useRef<AnnotatedPDFViewerRef>(null)
  const [allImageAnnotations, setAllImageAnnotations] = useState<RectangleAnnotation[]>([])
  const [allImageAnnotationsData, setAllImageAnnotationsData] = useState<Map<string, ImageAnnotationData>>(new Map())
  const [imageAnnotationsData, setImageAnnotationsData] = useState<Map<string, ImageAnnotationData>>(new Map())
  const [selectedImageAnnotationId, setSelectedImageAnnotationId] = useState<string | null>(null)

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
        setAllDocuments(response.files)
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
  }, [viewMode, textAnnotations, allBoundingBoxData, allImageAnnotations, allImageAnnotationsData])

  // Hide/show annotations based on viewMode
  useEffect(() => {
    if (!pdfViewerRef.current) return

    // Get IDs for text and image annotations
    const textAnnotationIds = new Set(textAnnotations.map(a => a.id).filter((id): id is string => !!id))
    const imageAnnotationIds = new Set(allImageAnnotations.map(a => a.id).filter((id): id is string => !!id))

    if (viewMode === 'text') {
      // Show text annotations, hide image annotations
      if (pdfViewerRef.current.showAnnotationsByIds) {
        pdfViewerRef.current.showAnnotationsByIds(textAnnotationIds)
      }
      if (pdfViewerRef.current.hideAnnotationsByIds) {
        pdfViewerRef.current.hideAnnotationsByIds(imageAnnotationIds)
      }
    } else {
      // Show image annotations, hide text annotations
      if (pdfViewerRef.current.showAnnotationsByIds) {
        pdfViewerRef.current.showAnnotationsByIds(imageAnnotationIds)
      }
      if (pdfViewerRef.current.hideAnnotationsByIds) {
        pdfViewerRef.current.hideAnnotationsByIds(textAnnotationIds)
      }
    }
  }, [viewMode, textAnnotations, allImageAnnotations])

  // Combine all annotations - both text and image - to pass to viewer
  // The viewer will show/hide them based on viewMode
  const currentAnnotations = useMemo(() => {
    // Return both sets of annotations
    return [...textAnnotations, ...allImageAnnotations]
  }, [textAnnotations, allImageAnnotations])

  // Navigation helpers
  const currentIndex = allDocuments.findIndex((doc) => doc.file_id === docid)
  const previousDoc = currentIndex > 0 ? allDocuments[currentIndex - 1] : null
  const nextDoc = currentIndex < allDocuments.length - 1 ? allDocuments[currentIndex + 1] : null

  const handlePrevious = () => {
    if (previousDoc) {
      navigate({ to: '/reviewer/review', search: { docid: previousDoc.file_id } })
    }
  }

  const handleNext = () => {
    if (nextDoc) {
      navigate({ to: '/reviewer/review', search: { docid: nextDoc.file_id } })
    }
  }

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

  return (
    <div className="fixed top-0 left-0 right-0 bottom-0 flex flex-col overflow-hidden bg-gray-50">
      <div className="flex-1 flex overflow-hidden">
        {/* PDF Viewer */}
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
            {!isLoading && !document && (
              <div className="absolute inset-0 flex items-center justify-center bg-white">
                <div className="text-center">
                  <p className="text-gray-500 mb-4">Document not found</p>
                  <button
                    onClick={() => navigate({ to: '/reviewer/queue' })}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  >
                    Go to Queue
                  </button>
                </div>
              </div>
            )}
            {document && (
              <AnnotatedPDFViewer
                ref={pdfViewerRef}
                documentId={docid}
                filename={document.filename}
                apiBaseUrl={import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'}
                onLoadComplete={handlePDFLoadComplete}
                annotations={currentAnnotations}
                onAnnotationSelected={(id) => {
                  if (viewMode === 'text') {
                    setSelectedAnnotationId(id)
                    setSelectedImageAnnotationId(null)
                  } else {
                    setSelectedImageAnnotationId(id)
                    setSelectedAnnotationId(null)
                  }
                }}
              />
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="w-80 bg-white border-l border-gray-200 flex flex-col">
          <div className="p-4 border-b border-gray-200">
            <div className="relative bg-gray-100 rounded-lg p-1 flex">
              <div
                className={`absolute top-1 bottom-1 w-1/2 bg-white rounded-md shadow-sm transition-transform duration-300 ease-in-out ${
                  viewMode === 'image' ? 'translate-x-full' : 'translate-x-0'
                }`}
              />
              <button
                onClick={() => setViewMode('text')}
                className={`relative z-10 flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors duration-300 ${
                  viewMode === 'text' ? 'text-gray-900' : 'text-gray-600'
                }`}
              >
                Text
              </button>
              <button
                onClick={() => setViewMode('image')}
                className={`relative z-10 flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors duration-300 ${
                  viewMode === 'image' ? 'text-gray-900' : 'text-gray-600'
                }`}
              >
                Image
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-hidden relative">
            {/* Sliding container */}
            <div
              className="flex h-full transition-transform duration-300 ease-in-out"
              style={{
                transform: viewMode === 'image' ? 'translateX(-100%)' : 'translateX(0%)',
                width: '200%',
              }}
            >
              {/* Text View */}
              <div className="w-1/2 overflow-auto p-6">
                {selectedAnnotationId && boundingBoxData.has(selectedAnnotationId) ? (
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-sm font-medium text-gray-700 mb-2">Annotation ID</h3>
                      <p className="text-sm text-gray-900">{selectedAnnotationId}</p>
                    </div>
                    {boundingBoxData.get(selectedAnnotationId)?.text && (
                      <div>
                        <h3 className="text-sm font-medium text-gray-700 mb-2">Text</h3>
                        <p className="text-sm text-gray-900 bg-gray-50 p-3 rounded border">
                          {boundingBoxData.get(selectedAnnotationId)?.text}
                        </p>
                      </div>
                    )}
                    {boundingBoxData.get(selectedAnnotationId)?.classification && (
                      <div>
                        <h3 className="text-sm font-medium text-gray-700 mb-2">Classification</h3>
                        <p className="text-sm text-gray-900">
                          {boundingBoxData.get(selectedAnnotationId)?.classification}
                        </p>
                      </div>
                    )}
                    {boundingBoxData.get(selectedAnnotationId)?.confidence !== undefined && (
                      <div>
                        <h3 className="text-sm font-medium text-gray-700 mb-2">Confidence</h3>
                        <p className="text-sm text-gray-900">
                          {(() => {
                            const confidence = boundingBoxData.get(selectedAnnotationId)?.confidence
                            if (typeof confidence === 'number') {
                              return `${(confidence * 100).toFixed(2)}%`
                            }
                            return confidence?.toString() || ''
                          })()}
                        </p>
                      </div>
                    )}
                    {boundingBoxData.get(selectedAnnotationId)?.explanation && (
                      <div>
                        <h3 className="text-sm font-medium text-gray-700 mb-2">Explanation</h3>
                        <p className="text-sm text-gray-900 bg-gray-50 p-3 rounded border">
                          {boundingBoxData.get(selectedAnnotationId)?.explanation}
                        </p>
                      </div>
                    )}
                    {boundingBoxData.get(selectedAnnotationId)?.type && (
                      <div>
                        <h3 className="text-sm font-medium text-gray-700 mb-2">Type</h3>
                        <p className="text-sm text-gray-900">{boundingBoxData.get(selectedAnnotationId)?.type}</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-gray-500 text-center">Select an annotation to view details</p>
                )}
              </div>

              {/* Image View */}
              <div className="w-1/2 overflow-auto p-6">
                {selectedImageAnnotationId && imageAnnotationsData.has(selectedImageAnnotationId) ? (
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-sm font-medium text-gray-700 mb-2">Image ID</h3>
                      <p className="text-sm text-gray-900">{selectedImageAnnotationId}</p>
                    </div>
                    {imageAnnotationsData.get(selectedImageAnnotationId) && (() => {
                      const imageData = imageAnnotationsData.get(selectedImageAnnotationId)!
                      return (
                        <>
                          <div>
                            <h3 className="text-sm font-medium text-gray-700 mb-2">Page</h3>
                            <p className="text-sm text-gray-900">{imageData.page}</p>
                          </div>
                          <div>
                            <h3 className="text-sm font-medium text-gray-700 mb-2">Image Index</h3>
                            <p className="text-sm text-gray-900">{imageData.image_index}</p>
                          </div>
                          <div>
                            <h3 className="text-sm font-medium text-gray-700 mb-2">Extension</h3>
                            <p className="text-sm text-gray-900">{imageData.extension.toUpperCase()}</p>
                          </div>
                          <div>
                            <h3 className="text-sm font-medium text-gray-700 mb-2">Size</h3>
                            <p className="text-sm text-gray-900">
                              {(imageData.size_bytes / 1024).toFixed(2)} KB
                            </p>
                          </div>
                          <div>
                            <h3 className="text-sm font-medium text-gray-700 mb-2">XRef</h3>
                            <p className="text-sm text-gray-900">{imageData.xref}</p>
                          </div>
                          <div>
                            <h3 className="text-sm font-medium text-gray-700 mb-2">Safe Search Results</h3>
                            <div className="bg-gray-50 p-3 rounded border space-y-2">
                              <div className="flex justify-between">
                                <span className="text-sm text-gray-600">Adult:</span>
                                <span className="text-sm text-gray-900">{imageData.safe_search.adult}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-sm text-gray-600">Spoof:</span>
                                <span className="text-sm text-gray-900">{imageData.safe_search.spoof}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-sm text-gray-600">Medical:</span>
                                <span className="text-sm text-gray-900">{imageData.safe_search.medical}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-sm text-gray-600">Violence:</span>
                                <span className="text-sm text-gray-900">{imageData.safe_search.violence}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-sm text-gray-600">Racy:</span>
                                <span className="text-sm text-gray-900">{imageData.safe_search.racy}</span>
                              </div>
                            </div>
                          </div>
                        </>
                      )
                    })()}
                  </div>
                ) : (
                  <p className="text-gray-500 text-center">Select an image annotation to view details</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="h-16 bg-white border-t border-gray-200 flex items-center justify-between px-6">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-semibold">{document?.filename || 'Document Viewer'}</h2>
          <p className="text-sm text-gray-500">File ID: {document?.file_id || docid}</p>
          {allDocuments.length > 0 && currentIndex >= 0 && (
            <p className="text-sm text-gray-500">
              Document {currentIndex + 1}/{allDocuments.length}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handlePrevious}
            disabled={!previousDoc || isLoading}
            className="px-4 py-2 text-sm font-medium rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          <button
            onClick={handleNext}
            disabled={!nextDoc || isLoading}
            className="px-4 py-2 text-sm font-medium rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
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
