import { useState } from 'react'
import { CircularProgressBar } from './CircularProgressBar'
import { API_BASE_URL } from '../../../utils/apiConfig'

interface TextAnnotationData {
  id: string
  text: string
  classification?: string
  confidence?: string | number
  explanation?: string
  type: string
}

interface TextAnnotationDetailsProps {
  annotationId: string | null
  annotationData: TextAnnotationData | undefined
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

function getClassificationBadgeStyles(classification?: string): string {
  if (!classification) return 'bg-gray-100 text-gray-800'
  
  const normalized = classification.toLowerCase().trim()
  if (normalized === 'unsafe') {
    return 'bg-red-100 text-red-800 border-red-200'
  }
  if (normalized === 'highly sensitive' || normalized === 'sensitive') {
    return 'bg-orange-100 text-orange-800 border-orange-200'
  }
  if (normalized === 'confidential') {
    return 'bg-yellow-100 text-yellow-800 border-yellow-200'
  }
  if (normalized === 'public') {
    return 'bg-green-100 text-green-800 border-green-200'
  }
  return 'bg-gray-100 text-gray-800 border-gray-200'
}

export function TextAnnotationDetails({ annotationId, annotationData }: TextAnnotationDetailsProps) {
  if (!annotationId || !annotationData) {
    return (
      <div className="w-full h-full overflow-auto p-6">
        <div className="flex flex-col items-center justify-center h-full min-h-[200px] text-center">
          <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
            <svg
              className="w-8 h-8 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </div>
          <p className="text-gray-500 text-sm">Select an annotation to view details</p>
        </div>
      </div>
    )
  }

  const confidencePercentage =
    typeof annotationData.confidence === 'number'
      ? annotationData.confidence * 100
      : null

  return (
    <div className="w-full h-full overflow-auto p-6 bg-white">
      <div className="space-y-6">
        {/* Classification Badge */}
        {annotationData.classification !== undefined && (
          <div className="flex items-start gap-3">
            <div className="flex-1">
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2 block">
                Classification
              </label>
              <div
                className={`inline-flex items-center px-3 py-1.5 rounded-md text-sm font-semibold border ${getClassificationBadgeStyles(
                  annotationData.classification
                )}`}
              >
                {annotationData.classification || 'Unknown'}
              </div>
            </div>
            {confidencePercentage !== null && (
              <div className="flex flex-col items-center">
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                  Confidence
                </label>
                <CircularProgressBar percentage={confidencePercentage} size={60} strokeWidth={6} />
              </div>
            )}
          </div>
        )}

        {/* Confidence (if classification not shown or separate) */}
        {annotationData.classification === undefined && annotationData.confidence !== undefined && (
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3 block">
              Confidence
            </label>
            {typeof annotationData.confidence === 'number' ? (
              <div className="flex items-center gap-4">
                <CircularProgressBar percentage={confidencePercentage!} size={70} strokeWidth={8} />
                <div className="flex flex-col">
                  <span className="text-2xl font-bold text-gray-900">
                    {(annotationData.confidence * 100).toFixed(1)}%
                  </span>
                  <span className="text-xs text-gray-500">confidence score</span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-900 font-medium">{annotationData.confidence.toString()}</p>
            )}
          </div>
        )}

        {/* Explanation */}
        {annotationData.explanation && (
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2 block">
              Explanation
            </label>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">
                {annotationData.explanation}
              </p>
            </div>
          </div>
        )}

        {/* Text Content */}
        {annotationData.text && (
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2 block">
              Extracted Text
            </label>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 max-h-64 overflow-y-auto">
              <p className="text-sm text-gray-900 leading-relaxed whitespace-pre-wrap break-words">
                {annotationData.text}
              </p>
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
