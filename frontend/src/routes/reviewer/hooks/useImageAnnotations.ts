import { useState, useEffect } from 'react'
import { type RectangleAnnotation } from '../types'
import { apiService } from '../../upload/api'
import { convertImageCoordinates, createImageAnnotationId } from '../utils'

/**
 * Data structure for image annotation metadata including safe search results.
 */
export interface ImageAnnotationData {
  page: number
  image_index: number
  xref: number
  extension: string
  size_bytes: number
  page_width: number
  page_height: number
  safe_search: {
    adult: string
    spoof: string
    medical: string
    violence: string
    racy: string
  }
  classification?: string
}

/**
 * Hook for fetching and managing image annotations from a document.
 * Fetches images from the API and converts their coordinates to the reference coordinate system.
 *
 * @param docid - The document ID to fetch annotations for. If null, clears all annotations.
 * @returns Object containing:
 *   - `allImageAnnotations`: Array of image annotations with converted coordinates
 *   - `allImageAnnotationsData`: Map of all image annotation IDs to their metadata
 *
 * @example
 * ```tsx
 * const { allImageAnnotations, allImageAnnotationsData } = useImageAnnotations(docid)
 *
 * // Render image annotations
 * allImageAnnotations.map(annotation => {
 *   const data = allImageAnnotationsData.get(annotation.id)
 *   return <ImageAnnotation key={annotation.id} {...annotation} data={data} />
 * })
 * ```
 */
export function useImageAnnotations(docid: string | null) {
  const [allImageAnnotations, setAllImageAnnotations] = useState<RectangleAnnotation[]>([])
  const [allImageAnnotationsData, setAllImageAnnotationsData] = useState<Map<string, ImageAnnotationData>>(new Map())

  useEffect(() => {
    if (!docid) {
      setAllImageAnnotations([])
      setAllImageAnnotationsData(new Map())
      return
    }

    const fetchImageAnnotations = async () => {
      try {
        const images = await apiService.getDocumentImages(docid)
        const annotations: RectangleAnnotation[] = []
        const dataMap = new Map<string, ImageAnnotationData>()

        images.forEach(image => {
          const pageNumber = image.page || 1
          const bbox = image.bounding_box

          if (bbox && image.page_width > 0 && image.page_height > 0) {
            const coords = convertImageCoordinates(bbox, image.page_width, image.page_height)
            const imageId = createImageAnnotationId(pageNumber, image.image_index)

            annotations.push({
              ...coords,
              pageNumber,
              id: imageId,
            })

            dataMap.set(imageId, {
              page: pageNumber,
              image_index: image.image_index,
              xref: image.xref,
              extension: image.extension,
              size_bytes: image.size_bytes,
              page_width: image.page_width,
              page_height: image.page_height,
              safe_search: image.safe_search,
            })
          }
        })

        setAllImageAnnotations(annotations)
        setAllImageAnnotationsData(dataMap)
      } catch (err) {
        console.error('Failed to fetch image annotations:', err)
        setAllImageAnnotations([])
        setAllImageAnnotationsData(new Map())
      }
    }

    fetchImageAnnotations()
  }, [docid])

  return { allImageAnnotations, allImageAnnotationsData }
}

