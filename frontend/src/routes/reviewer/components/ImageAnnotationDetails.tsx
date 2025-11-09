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

interface ImageAnnotationDetailsProps {
  annotationId: string | null
  annotationData: ImageAnnotationData | undefined
}

export function ImageAnnotationDetails({ annotationId, annotationData }: ImageAnnotationDetailsProps) {
  if (!annotationId || !annotationData) {
    return (
      <div className="w-80 shrink-0 overflow-auto p-6">
        <p className="text-gray-500 text-center">Select an image annotation to view details</p>
      </div>
    )
  }

  return (
    <div className="w-80 shrink-0 overflow-auto p-6">
      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-2">Image ID</h3>
          <p className="text-sm text-gray-900">{annotationId}</p>
        </div>
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-2">Page</h3>
          <p className="text-sm text-gray-900">{annotationData.page}</p>
        </div>
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-2">Image Index</h3>
          <p className="text-sm text-gray-900">{annotationData.image_index}</p>
        </div>
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-2">Extension</h3>
          <p className="text-sm text-gray-900">{annotationData.extension.toUpperCase()}</p>
        </div>
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-2">Size</h3>
          <p className="text-sm text-gray-900">
            {(annotationData.size_bytes / 1024).toFixed(2)} KB
          </p>
        </div>
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-2">XRef</h3>
          <p className="text-sm text-gray-900">{annotationData.xref}</p>
        </div>
      </div>
    </div>
  )
}

