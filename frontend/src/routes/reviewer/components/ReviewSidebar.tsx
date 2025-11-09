import { ViewModeSelector } from './ViewModeSelector'
import { ProgressBar } from './ProgressBar'
import { SelectionHeader } from './SelectionHeader'
import { TextAnnotationDetails } from './TextAnnotationDetails'
import { ImageAnnotationDetails } from './ImageAnnotationDetails'
import { useEffect } from 'react'

interface TextAnnotationData {
  id: string
  text: string
  classification?: string
  confidence?: string | number
  explanation?: string
  type: string
}

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

interface ReviewSidebarProps {
  viewMode: 'text' | 'image'
  onViewModeChange: (mode: 'text' | 'image') => void
  currentIndex: number
  totalCount: number
  selectedAnnotationId: string | null
  selectedImageAnnotationId: string | null
  boundingBoxData: Map<string, TextAnnotationData>
  imageAnnotationsData: Map<string, ImageAnnotationData>
}

export function ReviewSidebar({
  viewMode,
  onViewModeChange,
  currentIndex,
  totalCount,
  selectedAnnotationId,
  selectedImageAnnotationId,
  boundingBoxData,
  imageAnnotationsData,
}: ReviewSidebarProps) {

  useEffect(() => {
    console.log("imageAnnotationsData", imageAnnotationsData)
  }, [imageAnnotationsData])

  useEffect(() => {
    console.log("thisImageAnnotationData", imageAnnotationsData.get(selectedImageAnnotationId || ''))
  }, [selectedImageAnnotationId, imageAnnotationsData])
  return (
    <div className="w-80 bg-white border-l border-gray-200 flex flex-col">
      <ViewModeSelector viewMode={viewMode} onViewModeChange={onViewModeChange} />
      <ProgressBar currentIndex={currentIndex} totalCount={totalCount} />
      <SelectionHeader currentIndex={currentIndex} totalCount={totalCount} viewMode={viewMode} />

      <div className="flex-1 overflow-hidden relative">
        <div
          className="flex h-full transition-transform duration-300 ease-in-out"
          style={{
            transform: viewMode === 'image' ? 'translateX(-320px)' : 'translateX(0px)',
            width: '640px',
          }}
        >
          <TextAnnotationDetails
            annotationId={selectedAnnotationId}
            annotationData={selectedAnnotationId ? boundingBoxData.get(selectedAnnotationId) : undefined}
          />
          <ImageAnnotationDetails
            annotationId={selectedImageAnnotationId}
            annotationData={selectedImageAnnotationId ? imageAnnotationsData.get(selectedImageAnnotationId) : undefined}
          />
        </div>
      </div>
    </div>
  )
}

