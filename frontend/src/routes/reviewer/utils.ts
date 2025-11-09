import { type RectangleAnnotation } from '../pdftest/components/AnnotatedPDFViewer'

// Constants
export const REFERENCE_PAGE_WIDTH = 1758
export const REFERENCE_PAGE_HEIGHT = 2275
export const INITIAL_SELECTION_DELAY = 1500
export const LOADING_DISPLAY_DURATION = 3000

export const CRITICAL_CLASSIFICATIONS = ['Highly Sensitive', 'Confidential', 'Unsafe', '', undefined, null] as const
export const IMAGE_ANNOTATION_PREFIX = 'img-'

// Helper Functions
export const isCriticalClassification = (classification?: string | null): boolean => {
  return CRITICAL_CLASSIFICATIONS.some(crit => classification === crit)
}

export const createImageAnnotationId = (page: number, imageIndex: number): string => {
  return `${IMAGE_ANNOTATION_PREFIX}${page}-${imageIndex}`
}

export const isImageAnnotation = (id: string): boolean => {
  return id.startsWith(IMAGE_ANNOTATION_PREFIX)
}

export const convertImageCoordinates = (
  bbox: { x0: number; y0: number; x1: number; y1: number },
  pageWidth: number,
  pageHeight: number
): { startX: number; startY: number; endX: number; endY: number } => {
  const scaleX = REFERENCE_PAGE_WIDTH / pageWidth
  const scaleY = REFERENCE_PAGE_HEIGHT / pageHeight

  const startX = bbox.x0 * scaleX
  const startY = bbox.y0 * scaleY
  const endX = bbox.x1 * scaleX
  const endY = bbox.y1 * scaleY

  return {
    startX: Math.min(startX, endX),
    startY: Math.min(startY, endY),
    endX: Math.max(startX, endX),
    endY: Math.max(startY, endY),
  }
}

export const createBoundingBoxFromVertices = (
  vertices: Array<{ x: number; y: number }>,
  pageNumber: number,
  boxId: string
): RectangleAnnotation | null => {
  if (vertices.length < 2) return null

  const xs = vertices.map(v => v.x)
  const ys = vertices.map(v => v.y)

  return {
    startX: Math.min(...xs),
    startY: Math.min(...ys),
    endX: Math.max(...xs),
    endY: Math.max(...ys),
    pageNumber,
    id: boxId,
  }
}

