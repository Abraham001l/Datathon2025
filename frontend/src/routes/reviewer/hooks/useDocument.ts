import { useState, useEffect, useRef, useCallback } from 'react'
import type { Document } from '../../upload/types'
import { apiService } from '../../upload/api'
import { LOADING_DISPLAY_DURATION } from '../utils'

/**
 * Hook for fetching and managing document data.
 * Handles document loading state and provides a callback for when the PDF finishes loading.
 *
 * @param docid - The document ID to fetch. If null, loading is set to false and document is cleared.
 * @returns Object containing:
 *   - `document`: The fetched document or null if not found/not loaded
 *   - `isLoading`: Boolean indicating if the document is currently being fetched
 *   - `handlePDFLoadComplete`: Callback to call when PDF viewer finishes loading (delays loading state by LOADING_DISPLAY_DURATION)
 *
 * @example
 * ```tsx
 * const { document, isLoading, handlePDFLoadComplete } = useDocument(docid)
 *
 * // Use in PDF viewer
 * <PDFViewer onLoadComplete={handlePDFLoadComplete} />
 * ```
 */
export function useDocument(docid: string | null) {
  const [document, setDocument] = useState<Document | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!docid) {
      setIsLoading(false)
      return
    }

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }

    const fetchDocument = async () => {
      try {
        setIsLoading(true)
        const response = await apiService.getDocuments(100)
        const foundDoc = response.files.find(doc => doc.file_id === docid)
        setDocument(foundDoc || null)
      } catch (err) {
        console.error('Failed to fetch document:', err)
        setIsLoading(false)
      }
    }

    fetchDocument()
  }, [docid])

  const handlePDFLoadComplete = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => {
      setIsLoading(false)
      timeoutRef.current = null
    }, LOADING_DISPLAY_DURATION)
  }, [])

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  return { document, isLoading, handlePDFLoadComplete }
}
