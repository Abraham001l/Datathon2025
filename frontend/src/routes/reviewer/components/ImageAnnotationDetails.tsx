import { useState } from 'react'
import { API_BASE_URL } from '../../../utils/apiConfig'

interface ImageAnnotationData {
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

interface ImageAnnotationDetailsProps {
  annotationId: string | null
  annotationData: ImageAnnotationData | undefined
}

/**
 * Maps frontend classification names to backend classification names.
 */
const mapClassificationToBackend = (classification?: string | null): string | null => {
  if (!classification) return null
  
  const lower = classification.toLowerCase().trim()
  
  // Map "Highly Sensitive" or "Sensitive" to "sensitive"
  if (lower === 'highly sensitive' || lower === 'sensitive') {
    return 'sensitive'
  }
  // Map other classifications directly
  if (lower === 'confidential') {
    return 'confidential'
  }
  if (lower === 'public') {
    return 'public'
  }
  if (lower === 'unsafe') {
    return 'unsafe'
  }
  
  return null
}

export function ImageAnnotationDetails({ annotationId, annotationData }: ImageAnnotationDetailsProps) {
  if (!annotationId || !annotationData) {
    return (
      <div className="w-full h-full overflow-auto p-6">
        <p className="text-gray-500 text-center">Select an image annotation to view details</p>
      </div>
    )
  }

  return (
    <div className="w-full h-full overflow-auto p-6 bg-white">
      <div className="space-y-6">
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-2">Image ID</h3>
          <p className="text-sm text-gray-900">{annotationId}</p>
        </div>
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-2">Page</h3>
          <p className="text-sm text-gray-900">{annotationData.page}</p>
        </div>
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-2">Image Index</h3>
          <p className="text-sm text-gray-900">{annotationData.image_index}</p>
        </div>
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-2">Extension</h3>
          <p className="text-sm text-gray-900">{annotationData.extension.toUpperCase()}</p>
        </div>
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-2">Size</h3>
          <p className="text-sm text-gray-900">
            {(annotationData.size_bytes / 1024).toFixed(2)} KB
          </p>
        </div>
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-2">XRef</h3>
          <p className="text-sm text-gray-900">{annotationData.xref}</p>
        </div>

        {/* Classification */}
        {annotationData.classification && (
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2 block">
              Classification
            </label>
            <div className="inline-flex items-center px-3 py-1.5 rounded-md text-sm font-semibold border bg-gray-100 text-gray-800">
              {annotationData.classification}
            </div>
          </div>
        )}

        {/* AI Chain Edit Form */}
        {annotationData.classification && <AIChainEditForm classification={annotationData.classification} />}
      </div>
    </div>
  )
}

function AIChainEditForm({ classification }: { classification: string }) {
  const [suggestion, setSuggestion] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!suggestion.trim()) {
      setError('Please enter a suggestion')
      return
    }

    // Automatically use classification from the annotation
    const classificationToUse = mapClassificationToBackend(classification)

    if (!classificationToUse) {
      setError('Invalid classification. Cannot improve classification chain.')
      return
    }

    setIsLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const response = await fetch(`${API_BASE_URL}/top-agent/chain/ai-edit-by-classification`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          classification: classificationToUse,
          suggestion: suggestion.trim(),
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Failed to update classification chain' }))
        throw new Error(errorData.detail || `HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      setSuccess(data.message || `New prompt added to ${classificationToUse} chain successfully`)
      setSuggestion('')
      
      // Clear success message after 5 seconds
      setTimeout(() => {
        setSuccess(null)
      }, 5000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update classification chain')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="border-t border-gray-200 pt-6 mt-6">
      <h3 className="text-sm font-medium text-gray-700 mb-2">Improve Classification Chain</h3>
      <p className="text-xs text-gray-500 mb-3">
        Submit when wrong classification to improve prompt tree for future classifications.
      </p>
      
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label htmlFor="suggestion-input" className="block text-xs font-medium text-gray-600 mb-1">
            Suggestion
          </label>
          <textarea
            id="suggestion-input"
            value={suggestion}
            onChange={(e) => setSuggestion(e.target.value)}
            placeholder="Describe what the new prompt should address..."
            rows={3}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            disabled={isLoading}
          />
        </div>

        <button
          type="submit"
          disabled={isLoading || !suggestion.trim()}
          className="w-full px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading ? 'Submitting...' : 'Add Prompt to Chain'}
        </button>

        {error && (
          <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-md p-2">
            {error}
          </div>
        )}

        {success && (
          <div className="text-xs text-green-600 bg-green-50 border border-green-200 rounded-md p-2">
            {success}
          </div>
        )}
      </form>
    </div>
  )
}

