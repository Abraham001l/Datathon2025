import { useCallback } from 'react'
import { type RectangleAnnotation } from '../../pdftest/components/AnnotatedPDFViewer'

/**
 * Hook for basic annotation navigation (previous/next).
 * Provides handlers to navigate through annotations sequentially with wrapping behavior.
 *
 * @param currentAnnotationsList - The list of annotations to navigate through
 * @param currentBoxIndex - The current annotation index (0-based)
 * @param setCurrentBoxIndex - Function to update the current annotation index
 * @param selectAnnotationById - Function to select an annotation by its ID
 * @returns Object containing:
 *   - `handlePrevious`: Handler to navigate to the previous annotation (wraps to last if at first)
 *   - `handleNext`: Handler to navigate to the next annotation (wraps to first if at last)
 *   - `navigateToAnnotation`: Function to navigate to a specific annotation index
 *
 * @example
 * ```tsx
 * const { handlePrevious, handleNext, navigateToAnnotation } = useAnnotationNavigation(
 *   annotations,
 *   currentIndex,
 *   setCurrentIndex,
 *   selectById
 * )
 *
 * // Use in navigation buttons
 * <button onClick={handlePrevious}>Previous</button>
 * <button onClick={handleNext}>Next</button>
 * ```
 */
export function useAnnotationNavigation(
  currentAnnotationsList: RectangleAnnotation[],
  currentBoxIndex: number,
  setCurrentBoxIndex: (index: number) => void,
  selectAnnotationById: (id: string) => void
) {
  const navigateToAnnotation = useCallback(
    (targetIndex: number) => {
      if (targetIndex < 0 || targetIndex >= currentAnnotationsList.length) return

      setCurrentBoxIndex(targetIndex)
      const annotation = currentAnnotationsList[targetIndex]
      if (annotation?.id) {
        selectAnnotationById(annotation.id)
      }
    },
    [currentAnnotationsList, setCurrentBoxIndex, selectAnnotationById]
  )

  const handlePrevious = useCallback(() => {
    if (currentAnnotationsList.length === 0) return
    const newIndex = currentBoxIndex <= 0 ? currentAnnotationsList.length - 1 : currentBoxIndex - 1
    navigateToAnnotation(newIndex)
  }, [currentAnnotationsList, currentBoxIndex, navigateToAnnotation])

  const handleNext = useCallback(() => {
    if (currentAnnotationsList.length === 0) return
    const newIndex =
      currentBoxIndex >= currentAnnotationsList.length - 1 ? 0 : currentBoxIndex + 1
    navigateToAnnotation(newIndex)
  }, [currentAnnotationsList, currentBoxIndex, navigateToAnnotation])

  return { handlePrevious, handleNext, navigateToAnnotation }
}

