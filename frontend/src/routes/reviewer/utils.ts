import { type RectangleAnnotation } from './types'

// Constants
export const REFERENCE_PAGE_WIDTH = 1758
export const REFERENCE_PAGE_HEIGHT = 2275
export const INITIAL_SELECTION_DELAY = 1500
export const LOADING_DISPLAY_DURATION = 3000

// Flagged classifications are any classification over "public" (severity > 1)
// This includes: Highly Sensitive, Confidential, Unsafe
export const FLAGGED_CLASSIFICATIONS = ['Highly Sensitive', 'Confidential', 'Unsafe', '', undefined, null] as const
export const IMAGE_ANNOTATION_PREFIX = 'img-'

// Classification severity ranking (higher number = more severe)
const CLASSIFICATION_SEVERITY: Record<string, number> = {
  'unsafe': 4,
  'Unsafe': 4,
  'highly sensitive': 3,
  'Highly Sensitive': 3,
  'sensitive': 3,
  'Sensitive': 3,
  'confidential': 2,
  'Confidential': 2,
  'public': 1,
  'Public': 1,
  '': 5, // Empty string treated as unknown/worst case
}

/**
 * Normalizes a classification string to a standard format.
 */
export const normalizeClassification = (classification?: string | null): string | null => {
  if (!classification) return null
  
  const lower = classification.toLowerCase().trim()
  
  // Map common variations to standard format
  if (lower === 'sensitive' || lower === 'highly sensitive') {
    return 'Highly Sensitive'
  }
  if (lower === 'confidential') {
    return 'Confidential'
  }
  if (lower === 'unsafe') {
    return 'Unsafe'
  }
  if (lower === 'public') {
    return 'Public'
  }
  
  return classification
}

/**
 * Gets the severity rank of a classification (higher = more severe).
 */
export const getClassificationSeverity = (classification?: string | null): number => {
  if (!classification || classification.trim() === '') return 5 // Unknown/null/empty treated as worst case
  
  const normalized = normalizeClassification(classification)
  if (!normalized) return 5
  
  return CLASSIFICATION_SEVERITY[normalized] || CLASSIFICATION_SEVERITY[normalized.toLowerCase()] || 5
}

/**
 * Estimates the document classification from the worst case classification across all annotations.
 * Returns the most severe classification found, or null if no classifications exist.
 */
export const estimateDocumentClassification = (
  textAnnotationsData: Map<string, { classification?: string }>,
  imageAnnotationsData: Map<string, { classification?: string }>
): string | null => {
  let worstSeverity = 0
  let worstClassification: string | null = null
  let hasAnyClassification = false
  
  // Check text annotations
  for (const data of textAnnotationsData.values()) {
    const classification = data.classification
    // Skip undefined, null, and empty strings - only consider actual classifications
    if (classification !== undefined && classification !== null && classification.trim() !== '') {
      hasAnyClassification = true
      const severity = getClassificationSeverity(classification)
      // Only update if we have a valid severity (not the default 5 for unknown)
      if (severity > worstSeverity && severity < 5) {
        worstSeverity = severity
        worstClassification = normalizeClassification(classification)
      }
    }
  }
  
  // Check image annotations
  for (const data of imageAnnotationsData.values()) {
    const classification = data.classification
    // Skip undefined, null, and empty strings - only consider actual classifications
    if (classification !== undefined && classification !== null && classification.trim() !== '') {
      hasAnyClassification = true
      const severity = getClassificationSeverity(classification)
      // Only update if we have a valid severity (not the default 5 for unknown)
      if (severity > worstSeverity && severity < 5) {
        worstSeverity = severity
        worstClassification = normalizeClassification(classification)
      }
    }
  }
  
  // If no valid classification found, return null
  if (!hasAnyClassification || worstSeverity === 0 || !worstClassification) {
    return null
  }
  
  return worstClassification
}

/**
 * Gets the RGB color for a classification.
 * Returns an object with r, g, b values (0-255).
 */
export const getClassificationColor = (classification?: string | null): { r: number; g: number; b: number } => {
  if (!classification) return { r: 180, g: 180, b: 180 } // Light gray for unknown
  
  const normalized = normalizeClassification(classification)
  if (!normalized) return { r: 180, g: 180, b: 180 } // Light gray for unknown
  
  const lower = normalized.toLowerCase().trim()
  
  if (lower === 'unsafe') {
    return { r: 248, g: 113, b: 113 } // Red-300 (lighter)
  }
  if (lower === 'highly sensitive' || lower === 'sensitive') {
    return { r: 253, g: 186, b: 116 } // Orange-300 (lighter)
  }
  if (lower === 'confidential') {
    return { r: 253, g: 224, b: 71 } // Yellow-300 (lighter)
  }
  if (lower === 'public') {
    return { r: 134, g: 239, b: 172 } // Green-300 (lighter)
  }
  
  return { r: 180, g: 180, b: 180 } // Light gray for unknown
}

// Helper Functions
/**
 * Checks if a classification should be flagged (any classification over "public").
 * Returns true for Highly Sensitive, Confidential, Unsafe, or unknown classifications.
 */
export const isFlaggedClassification = (classification?: string | null): boolean => {
  if (!classification || classification.trim() === '') return true // Unknown/null/empty treated as flagged
  
  const normalized = normalizeClassification(classification)
  if (!normalized) return true // Unknown classification treated as flagged
  
  const severity = getClassificationSeverity(classification)
  // Flag any classification with severity > 1 (i.e., over "public")
  return severity > 1
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

