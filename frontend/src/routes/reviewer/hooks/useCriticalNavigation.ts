import { useCallback } from 'react'
import { type RectangleAnnotation } from '../types'

/**
 * Hook for navigating between critical annotations (e.g., Highly Sensitive, Confidential, Unsafe).
 * Provides handlers to move to the previous or next critical annotation with wrapping behavior.
 *
 * @param criticalAnnotationIndices - Array of indices in the annotations list that are marked as critical
 * @param currentBoxIndex - The current annotation index being viewed
 * @param currentAnnotationsList - The full list of annotations to navigate through
 * @param setCurrentBoxIndex - Function to update the current annotation index
 * @param selectAnnotationById - Function to select an annotation by its ID
 * @returns Object containing `handlePreviousCritical` and `handleNextCritical` navigation handlers
 *
 * @example
 * ```tsx
 * const { handlePreviousCritical, handleNextCritical } = useCriticalNavigation(
 *   criticalIndices,
 *   currentIndex,
 *   annotations,
 *   setCurrentIndex,
 *   selectById
 * )
 * ```
 */
export function useCriticalNavigation(
  criticalAnnotationIndices: number[],
  currentBoxIndex: number,
  currentAnnotationsList: RectangleAnnotation[],
  setCurrentBoxIndex: (index: number) => void,
  selectAnnotationById: (id: string) => void
) {
  const findCurrentCriticalIndex = useCallback(
    (currentIndex: number): number => {
      return criticalAnnotationIndices.findIndex(idx => idx === currentIndex)
    },
    [criticalAnnotationIndices]
  )

  const handlePreviousCritical = useCallback(() => {
    if (criticalAnnotationIndices.length === 0) return

    let currentCriticalIndex = findCurrentCriticalIndex(currentBoxIndex)

    if (currentCriticalIndex < 0) {
      const previousCritical = criticalAnnotationIndices
        .filter(idx => idx < currentBoxIndex)
        .sort((a, b) => b - a)[0]

      if (previousCritical !== undefined) {
        currentCriticalIndex = criticalAnnotationIndices.indexOf(previousCritical)
      } else {
        currentCriticalIndex = criticalAnnotationIndices.length
      }
    }

    const targetIndex =
      currentCriticalIndex <= 0
        ? criticalAnnotationIndices[criticalAnnotationIndices.length - 1]
        : criticalAnnotationIndices[currentCriticalIndex - 1]

    setCurrentBoxIndex(targetIndex)
    const annotation = currentAnnotationsList[targetIndex]
    if (annotation?.id) {
      selectAnnotationById(annotation.id)
    }
  }, [
    criticalAnnotationIndices,
    currentBoxIndex,
    currentAnnotationsList,
    findCurrentCriticalIndex,
    setCurrentBoxIndex,
    selectAnnotationById,
  ])

  const handleNextCritical = useCallback(() => {
    if (criticalAnnotationIndices.length === 0) return

    let currentCriticalIndex = findCurrentCriticalIndex(currentBoxIndex)

    if (currentCriticalIndex < 0) {
      const nextCritical = criticalAnnotationIndices
        .filter(idx => idx > currentBoxIndex)
        .sort((a, b) => a - b)[0]

      if (nextCritical !== undefined) {
        currentCriticalIndex = criticalAnnotationIndices.indexOf(nextCritical)
      } else {
        currentCriticalIndex = criticalAnnotationIndices.length - 1
      }
    }

    const targetIndex =
      currentCriticalIndex < 0 || currentCriticalIndex >= criticalAnnotationIndices.length - 1
        ? criticalAnnotationIndices[0]
        : criticalAnnotationIndices[currentCriticalIndex + 1]

    setCurrentBoxIndex(targetIndex)
    const annotation = currentAnnotationsList[targetIndex]
    if (annotation?.id) {
      selectAnnotationById(annotation.id)
    }
  }, [
    criticalAnnotationIndices,
    currentBoxIndex,
    currentAnnotationsList,
    findCurrentCriticalIndex,
    setCurrentBoxIndex,
    selectAnnotationById,
  ])

  return { handlePreviousCritical, handleNextCritical }
}
