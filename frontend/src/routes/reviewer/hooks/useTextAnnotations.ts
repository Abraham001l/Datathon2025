import { useState, useEffect, useMemo } from 'react'
import { type RectangleAnnotation } from '../../pdftest/components/AnnotatedPDFViewer'
import { apiService } from '../../upload/api'
import { createBoundingBoxFromVertices } from '../utils'

/**
 * Data structure for text annotation metadata.
 */
export interface TextAnnotationData {
  id: string
  text: string
  classification?: string
  confidence?: string | number
  explanation?: string
  type: string
}

/**
 * Hook for fetching and managing text annotations from a document.
 * Fetches bounding boxes from the API and filters them to only include text/block annotations.
 *
 * @param docid - The document ID to fetch annotations for. If null, clears all annotations.
 * @returns Object containing:
 *   - `textAnnotations`: Filtered array of text/block annotations (excludes image annotations)
 *   - `allBoundingBoxData`: Map of all annotation IDs to their metadata
 *
 * @example
 * ```tsx
 * const { textAnnotations, allBoundingBoxData } = useTextAnnotations(docid)
 *
 * // Render annotations
 * textAnnotations.map(annotation => (
 *   <AnnotationBox key={annotation.id} {...annotation} />
 * ))
 * ```
 */
export function useTextAnnotations(docid: string | null) {
  const [allBoundingBoxes, setAllBoundingBoxes] = useState<RectangleAnnotation[]>([])
  const [allBoundingBoxData, setAllBoundingBoxData] = useState<Map<string, TextAnnotationData>>(new Map())

  useEffect(() => {
    if (!docid) {
      setAllBoundingBoxes([])
      setAllBoundingBoxData(new Map())
      return
    }

    const fetchBoundingBoxes = async () => {
      try {
        const pages = await apiService.getDocumentBoundingBoxes(docid)
        const annotations: RectangleAnnotation[] = []
        const dataMap = new Map<string, TextAnnotationData>()

        pages.forEach(page => {
          const pageNumber = page.page_number || 1
          page.bounding_boxes?.forEach((box, index) => {
            const vertices = box.bounding_box?.vertices || []
            const boxId = box.id || `${pageNumber}-${index + 1}`
            const annotation = createBoundingBoxFromVertices(vertices, pageNumber, boxId)

            if (annotation) {
              annotations.push(annotation)
              dataMap.set(boxId, {
                id: boxId,
                text: box.text || '',
                classification: box.classification,
                confidence: box.confidence,
                explanation: box.explanation,
                type: box.type || 'block',
              })
            }
          })
        })

        setAllBoundingBoxes(annotations)
        setAllBoundingBoxData(dataMap)
      } catch (err) {
        console.error('Failed to fetch bounding boxes:', err)
        setAllBoundingBoxes([])
        setAllBoundingBoxData(new Map())
      }
    }

    fetchBoundingBoxes()
  }, [docid])

  const textAnnotations = useMemo(() => {
    return allBoundingBoxes.filter(annotation => {
      const data = allBoundingBoxData.get(annotation.id || '')
      return data && (data.type === 'block' || data.type === 'text' || !data.type || data.type !== 'image')
    })
  }, [allBoundingBoxes, allBoundingBoxData])

  return { textAnnotations, allBoundingBoxData }
}
