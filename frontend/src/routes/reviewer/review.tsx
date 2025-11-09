import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState, useEffect, useRef, useMemo } from 'react'
import { AnnotatedPDFViewer, type AnnotatedPDFViewerRef } from '../pdftest/components/AnnotatedPDFViewer'
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
  validateSearch: (search: Record<string, unknown>) => {
    return {
      docid: (search.docid as string) || null,
    }
  },
})

function ReviewComponent() {
  const { docid } = Route.useSearch()
  const navigate = useNavigate()
  const [viewMode, setViewMode] = useState<ViewMode>('text')
  const [currentBoxIndex, setCurrentBoxIndex] = useState<number>(-1)
  const pdfViewerRef = useRef<AnnotatedPDFViewerRef>(null)
  const initializedRef = useRef<Set<string>>(new Set())

  // Data hooks
  const { document, isLoading, handlePDFLoadComplete } = useDocument(docid)
  const { textAnnotations, allBoundingBoxData } = useTextAnnotations(docid)
  const { allImageAnnotations, allImageAnnotationsData } = useImageAnnotations(docid)

  // Annotation selection
  const {
    selectedAnnotationId,
    selectedImageAnnotationId,
    handleAnnotationSelected,
    selectAnnotationById,
    clearSelection,
  } = useAnnotationSelection(viewMode, pdfViewerRef)

  // Filter annotations based on view mode
  const currentAnnotations = useMemo(() => {
    return viewMode === 'text' ? textAnnotations : allImageAnnotations
  }, [viewMode, textAnnotations, allImageAnnotations])

  const currentAnnotationsList = currentAnnotations

  // Update sidebar data based on viewMode
  const [boundingBoxData, setBoundingBoxData] = useState<Map<string, TextAnnotationData>>(new Map())
  const [imageAnnotationsData, setImageAnnotationsData] = useState<Map<string, ImageAnnotationData>>(
    new Map()
  )

  useEffect(() => {
    if (viewMode === 'text') {
      const textDataMap = new Map<string, TextAnnotationData>()
      textAnnotations.forEach(annotation => {
        const data = allBoundingBoxData.get(annotation.id || '')
        if (data) {
          textDataMap.set(annotation.id || '', data)
        }
      })
      setBoundingBoxData(textDataMap)
      setImageAnnotationsData(new Map())
    } else {
      const imageDataMap = new Map<string, ImageAnnotationData>()
      allImageAnnotations.forEach(annotation => {
        const data = allImageAnnotationsData.get(annotation.id || '')
        if (data) {
          imageDataMap.set(annotation.id || '', data)
        }
      })
      setImageAnnotationsData(imageDataMap)
      setBoundingBoxData(new Map())
    }
    clearSelection()
    setCurrentBoxIndex(-1)
  }, [viewMode, textAnnotations, allBoundingBoxData, allImageAnnotations, allImageAnnotationsData, clearSelection])

  // Calculate critical annotations
  const criticalAnnotationIndices = useMemo(() => {
    return currentAnnotationsList
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
  }, [currentAnnotationsList, viewMode, allBoundingBoxData, allImageAnnotationsData])

  // Navigation
  const { handlePrevious, handleNext } = useAnnotationNavigation(
    currentAnnotationsList,
    currentBoxIndex,
    setCurrentBoxIndex,
    selectAnnotationById
  )

  const { handlePreviousCritical, handleNextCritical } = useCriticalNavigation(
    criticalAnnotationIndices,
    currentBoxIndex,
    currentAnnotationsList,
    setCurrentBoxIndex,
    selectAnnotationById
  )

  // Initialize first annotation on load
  useEffect(() => {
    const key = `${docid}-${viewMode}-${currentAnnotationsList.length}`
    if (currentAnnotationsList.length > 0) {
      if (
        !initializedRef.current.has(key) ||
        currentBoxIndex < 0 ||
        currentBoxIndex >= currentAnnotationsList.length
      ) {
        initializedRef.current.add(key)
        setCurrentBoxIndex(0)
        const firstBox = currentAnnotationsList[0]
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
  }, [currentAnnotationsList, docid, viewMode, currentBoxIndex, clearSelection, selectAnnotationById])

  // Sync index with selection
  useEffect(() => {
    const selectedId = viewMode === 'text' ? selectedAnnotationId : selectedImageAnnotationId
    if (selectedId && currentAnnotationsList.length > 0) {
      const index = currentAnnotationsList.findIndex(box => box.id === selectedId)
      if (index >= 0 && index !== currentBoxIndex) {
        setCurrentBoxIndex(index)
      }
    }
  }, [selectedAnnotationId, selectedImageAnnotationId, currentAnnotationsList, currentBoxIndex, viewMode])

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

  // Handle annotation selection with view mode validation
  const handlePDFAnnotationSelected = (id: string | null) => {
    if (!id) {
      handleAnnotationSelected(null)
      return
    }

    const isImageAnnotation = id.startsWith('img-')

    if (viewMode === 'text') {
      if (!isImageAnnotation) {
        handleAnnotationSelected(id)
      } else {
        handleAnnotationSelected(null)
      }
    } else {
      if (isImageAnnotation) {
        handleAnnotationSelected(id)
      } else {
        handleAnnotationSelected(null)
      }
    }
  }

  return (
    <div className="fixed top-0 left-0 right-0 bottom-0 flex flex-col overflow-hidden bg-gray-50">
      <div className="flex-1 flex overflow-hidden">
        {/* PDF Viewer Container */}
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
                onLoadComplete={handlePDFLoadComplete}
                annotations={currentAnnotations}
                onAnnotationSelected={handlePDFAnnotationSelected}
              />
            )}
          </div>
        </div>

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

      {/* Bottom Navigation Bar */}
      <div className="h-16 bg-white border-t border-gray-200 flex items-center justify-between px-6">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-semibold">{document?.filename || 'Document Viewer'}</h2>
          <p className="text-sm text-gray-500">File ID: {document?.file_id || docid || ''}</p>
          {currentAnnotationsList.length > 0 && currentBoxIndex >= 0 && (
            <p className="text-sm text-gray-500">
              {viewMode === 'text' ? 'Text' : 'Image'} {currentBoxIndex + 1}/{currentAnnotationsList.length}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handlePrevious}
            disabled={currentAnnotationsList.length === 0 || isLoading}
            className="px-4 py-2 text-sm font-medium rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous {viewMode === 'text' ? 'Text' : 'Image'}
          </button>
          <button
            onClick={handleNext}
            disabled={currentAnnotationsList.length === 0 || isLoading}
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
