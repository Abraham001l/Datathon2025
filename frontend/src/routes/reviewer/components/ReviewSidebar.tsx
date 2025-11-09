import { ViewModeSelector } from './ViewModeSelector'
import { ProgressBar } from './ProgressBar'
import { SelectionHeader } from './SelectionHeader'
import { TextAnnotationDetails } from './TextAnnotationDetails'
import { ImageAnnotationDetails } from './ImageAnnotationDetails'
import { SafeSearchColorBars } from './SafeSearchColorBars'

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
  classification?: string
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
  documentFilename?: string
  sidebarWidth: number
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
  documentFilename,
  sidebarWidth,
}: ReviewSidebarProps) {

  const selectedImageData = selectedImageAnnotationId
    ? imageAnnotationsData.get(selectedImageAnnotationId)
    : undefined

  return (
    <div className="w-full h-full bg-white flex flex-col">
      <ViewModeSelector viewMode={viewMode} onViewModeChange={onViewModeChange} />
      <ProgressBar currentIndex={currentIndex} totalCount={totalCount} />


      <SelectionHeader currentIndex={currentIndex} totalCount={totalCount} viewMode={viewMode} documentFilename={documentFilename} />

      {viewMode === 'image' && (
        <SafeSearchColorBars safeSearch={selectedImageData?.safe_search} />
      )}
      <div className="flex-1 overflow-hidden relative">
        <div
          className="flex h-full transition-transform duration-300 ease-in-out"
          style={{
            transform: viewMode === 'image' ? `translateX(-${sidebarWidth}px)` : 'translateX(0px)',
            width: `${sidebarWidth * 2}px`,
          }}
        >
          <div className="w-full shrink-0" style={{ width: `${sidebarWidth}px` }}>
            <TextAnnotationDetails
              annotationId={selectedAnnotationId}
              annotationData={selectedAnnotationId ? boundingBoxData.get(selectedAnnotationId) : undefined}
            />
          </div>
          <div className="w-full shrink-0" style={{ width: `${sidebarWidth}px` }}>
            <ImageAnnotationDetails
              annotationId={selectedImageAnnotationId}
              annotationData={selectedImageAnnotationId ? imageAnnotationsData.get(selectedImageAnnotationId) : undefined}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

