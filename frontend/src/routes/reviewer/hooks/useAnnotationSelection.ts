import { useState, useCallback } from 'react'
import { type AnnotatedPDFViewerRef } from '../../pdftest/components/AnnotatedPDFViewer'
import { isImageAnnotation } from '../utils'

/**
 * View mode type for switching between text and image annotation views.
 */
export type ViewMode = 'image' | 'text'

/**
 * Hook for managing annotation selection state.
 * Handles selection of both text and image annotations based on the current view mode.
 * Ensures only valid annotations can be selected (text annotations in text mode, image annotations in image mode).
 *
 * @param viewMode - Current view mode ('text' or 'image')
 * @param pdfViewerRef - Ref to the PDF viewer component for programmatic selection
 * @returns Object containing:
 *   - `selectedAnnotationId`: Currently selected text annotation ID (null if none)
 *   - `selectedImageAnnotationId`: Currently selected image annotation ID (null if none)
 *   - `handleAnnotationSelected`: Handler for when an annotation is selected (validates based on view mode)
 *   - `selectAnnotationById`: Function to programmatically select an annotation by ID
 *   - `clearSelection`: Function to clear the current selection
 *
 * @example
 * ```tsx
 * const {
 *   selectedAnnotationId,
 *   selectedImageAnnotationId,
 *   handleAnnotationSelected,
 *   selectAnnotationById,
 *   clearSelection
 * } = useAnnotationSelection(viewMode, pdfViewerRef)
 *
 * // Use in PDF viewer
 * <PDFViewer onAnnotationSelected={handleAnnotationSelected} />
 * ```
 */
export function useAnnotationSelection(
  viewMode: ViewMode,
  pdfViewerRef: React.RefObject<AnnotatedPDFViewerRef | null>
) {
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null)
  const [selectedImageAnnotationId, setSelectedImageAnnotationId] = useState<string | null>(null)

  const setSelection = useCallback(
    (id: string | null, isImage: boolean) => {
      if (isImage) {
        setSelectedImageAnnotationId(id)
        setSelectedAnnotationId(null)
      } else {
        setSelectedAnnotationId(id)
        setSelectedImageAnnotationId(null)
      }
    },
    []
  )

  const clearSelection = useCallback(() => {
    setSelectedAnnotationId(null)
    setSelectedImageAnnotationId(null)
  }, [])

  const handleAnnotationSelected = useCallback(
    (id: string | null) => {
      if (!id) {
        clearSelection()
        return
      }

      const isImage = isImageAnnotation(id)
      const isValidSelection =
        (viewMode === 'text' && !isImage) || (viewMode === 'image' && isImage)

      if (isValidSelection) {
        setSelection(id, isImage)
      } else {
        clearSelection()
      }
    },
    [viewMode, setSelection, clearSelection]
  )

  const selectAnnotationById = useCallback(
    (id: string) => {
      if (pdfViewerRef.current) {
        pdfViewerRef.current.selectAnnotationById(id)
      }
      const isImage = isImageAnnotation(id)
      setSelection(id, isImage)
    },
    [pdfViewerRef, setSelection]
  )

  return {
    selectedAnnotationId,
    selectedImageAnnotationId,
    handleAnnotationSelected,
    selectAnnotationById,
    clearSelection,
  }
}

