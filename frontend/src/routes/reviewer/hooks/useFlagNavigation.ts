import { useCallback } from 'react'
import { type RectangleAnnotation } from '../types'

/**
 * Hook for navigating between flagged annotations (e.g., Highly Sensitive, Confidential, Unsafe).
 * Provides handlers to move to the previous or next flagged annotation with wrapping behavior.
 *
 * @param flaggedAnnotationIndices - Array of indices in the annotations list that are marked as flagged
 * @param currentBoxIndex - The current annotation index being viewed
 * @param currentAnnotationsList - The full list of annotations to navigate through
 * @param setCurrentBoxIndex - Function to update the current annotation index
 * @param selectAnnotationById - Function to select an annotation by its ID
 * @returns Object containing `handlePreviousFlag` and `handleNextFlag` navigation handlers
 *
 * @example
 * ```tsx
 * const { handlePreviousFlag, handleNextFlag } = useFlagNavigation(
 *   flaggedIndices,
 *   currentIndex,
 *   annotations,
 *   setCurrentIndex,
 *   selectById
 * )
 * ```
 */
export function useFlagNavigation(
  flaggedAnnotationIndices: number[],
  currentBoxIndex: number,
  currentAnnotationsList: RectangleAnnotation[],
  setCurrentBoxIndex: (index: number) => void,
  selectAnnotationById: (id: string) => void
) {
  const findCurrentFlaggedIndex = useCallback(
    (currentIndex: number): number => {
      return flaggedAnnotationIndices.findIndex(idx => idx === currentIndex)
    },
    [flaggedAnnotationIndices]
  )

  const handlePreviousFlag = useCallback(() => {
    if (flaggedAnnotationIndices.length === 0) return

    let currentFlaggedIndex = findCurrentFlaggedIndex(currentBoxIndex)

    if (currentFlaggedIndex < 0) {
      const previousFlagged = flaggedAnnotationIndices
        .filter(idx => idx < currentBoxIndex)
        .sort((a, b) => b - a)[0]

      if (previousFlagged !== undefined) {
        currentFlaggedIndex = flaggedAnnotationIndices.indexOf(previousFlagged)
      } else {
        currentFlaggedIndex = flaggedAnnotationIndices.length
      }
    }

    const targetIndex =
      currentFlaggedIndex <= 0
        ? flaggedAnnotationIndices[flaggedAnnotationIndices.length - 1]
        : flaggedAnnotationIndices[currentFlaggedIndex - 1]

    setCurrentBoxIndex(targetIndex)
    const annotation = currentAnnotationsList[targetIndex]
    if (annotation?.id) {
      selectAnnotationById(annotation.id)
    }
  }, [
    flaggedAnnotationIndices,
    currentBoxIndex,
    currentAnnotationsList,
    findCurrentFlaggedIndex,
    setCurrentBoxIndex,
    selectAnnotationById,
  ])

  const handleNextFlag = useCallback(() => {
    if (flaggedAnnotationIndices.length === 0) return

    let currentFlaggedIndex = findCurrentFlaggedIndex(currentBoxIndex)

    if (currentFlaggedIndex < 0) {
      const nextFlagged = flaggedAnnotationIndices
        .filter(idx => idx > currentBoxIndex)
        .sort((a, b) => a - b)[0]

      if (nextFlagged !== undefined) {
        currentFlaggedIndex = flaggedAnnotationIndices.indexOf(nextFlagged)
      } else {
        currentFlaggedIndex = flaggedAnnotationIndices.length - 1
      }
    }

    const targetIndex =
      currentFlaggedIndex < 0 || currentFlaggedIndex >= flaggedAnnotationIndices.length - 1
        ? flaggedAnnotationIndices[0]
        : flaggedAnnotationIndices[currentFlaggedIndex + 1]

    setCurrentBoxIndex(targetIndex)
    const annotation = currentAnnotationsList[targetIndex]
    if (annotation?.id) {
      selectAnnotationById(annotation.id)
    }
  }, [
    flaggedAnnotationIndices,
    currentBoxIndex,
    currentAnnotationsList,
    findCurrentFlaggedIndex,
    setCurrentBoxIndex,
    selectAnnotationById,
  ])

  return { handlePreviousFlag, handleNextFlag }
}

