export interface RectangleAnnotation {
  startX: number
  startY: number
  endX: number
  endY: number
  pageNumber?: number
  id?: string
}

export interface AnnotatedPDFViewerRef {
  selectAnnotationById: (annotationId: string) => void
  scrollToPage: (pageNumber: number) => void
  deselectAnnotations: () => void
  clearAnnotations: () => void
  hideAllAnnotations: () => void
  showAllAnnotations: () => void
  hideAnnotationsByIds: (ids: Set<string>) => void
  showAnnotationsByIds: (ids: Set<string>) => void
}

