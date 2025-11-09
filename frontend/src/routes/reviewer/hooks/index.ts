/**
 * Custom hooks for the reviewer module.
 * 
 * This module exports all hooks used for document review functionality:
 * - Data fetching hooks (useDocument, useTextAnnotations, useImageAnnotations)
 * - Selection management hooks (useAnnotationSelection)
 * - Navigation hooks (useAnnotationNavigation, useCriticalNavigation)
 * 
 * All hooks include comprehensive JSDoc documentation. See individual hook files for details.
 */

export { useDocument } from './useDocument'
export { useTextAnnotations, type TextAnnotationData } from './useTextAnnotations'
export { useImageAnnotations, type ImageAnnotationData } from './useImageAnnotations'
export { useAnnotationSelection, type ViewMode } from './useAnnotationSelection'
export { useAnnotationNavigation } from './useAnnotationNavigation'
export { useCriticalNavigation } from './useCriticalNavigation'

