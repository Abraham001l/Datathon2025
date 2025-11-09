interface TextAnnotationData {
  id: string
  text: string
  classification?: string
  confidence?: string | number
  explanation?: string
  type: string
}

interface TextAnnotationDetailsProps {
  annotationId: string | null
  annotationData: TextAnnotationData | undefined
}

export function TextAnnotationDetails({ annotationId, annotationData }: TextAnnotationDetailsProps) {
  if (!annotationId || !annotationData) {
    return (
      <div className="w-80 shrink-0 overflow-auto p-6">
        <p className="text-gray-500 text-center">Select an annotation to view details</p>
      </div>
    )
  }

  return (
    <div className="w-80 shrink-0 overflow-auto p-6">
      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-2">Annotation ID</h3>
          <p className="text-sm text-gray-900">{annotationId}</p>
        </div>
        {annotationData.classification !== undefined && (
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-2">Classification</h3>
            <p className="text-sm text-gray-900">{annotationData.classification}</p>
          </div>
        )}
        {annotationData.confidence !== undefined && (
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-2">Confidence</h3>
            <p className="text-sm text-gray-900">
              {typeof annotationData.confidence === 'number'
                ? `${(annotationData.confidence * 100).toFixed(2)}%`
                : annotationData.confidence?.toString() || ''}
            </p>
          </div>
        )}
        {annotationData.explanation !== undefined && (
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-2">Explanation</h3>
            <p className="text-sm text-gray-900 bg-gray-50 p-3 rounded border">
              {annotationData.explanation}
            </p>
          </div>
        )}
        {annotationData.text && (
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-2">Text</h3>
            <p className="text-sm text-gray-900 bg-gray-50 p-3 rounded border">
              {annotationData.text}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

