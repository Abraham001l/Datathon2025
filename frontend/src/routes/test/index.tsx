import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { API_BASE_URL } from '../../utils/apiConfig'

interface DocumentInfo {
  file_id: string
  filename: string
  upload_date?: string
  length: number
  content_type?: string
  metadata?: {
    description?: string
    category?: string
    status?: string
    ai_classified_sensitivity?: string
  }
}

export const Route = createFileRoute('/test/')({
  component: Test,
})

function Test() {
  const [fileId, setFileId] = useState<string>('')
  const [documents, setDocuments] = useState<DocumentInfo[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>('')
  const [pdfUrl, setPdfUrl] = useState<string>('')

  useEffect(() => {
    loadDocuments()
  }, [])

  const loadDocuments = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/view/document?limit=20`)
      if (!response.ok) {
        throw new Error('Failed to load documents')
      }
      const data = await response.json()
      setDocuments(data.files || [])
    } catch (err) {
      console.error('Error loading documents:', err)
      setError('Failed to load documents')
    }
  }

  const handleStreamPdf = () => {
    if (!fileId.trim()) {
      setError('Please enter a file ID')
      return
    }

    setError('')
    setLoading(true)
    
    // Create URL for streaming the PDF
    const streamUrl = `${API_BASE_URL}/view/document/${fileId}`
    setPdfUrl(streamUrl)
    setLoading(false)
  }

  const handleSelectDocument = (doc: DocumentInfo) => {
    setFileId(doc.file_id)
    setError('')
  }

  return (
    <div className="max-w-7xl mx-auto p-8">
      <h1 className="text-4xl font-bold mb-6">PDF Streaming Test</h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Controls */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              File ID
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={fileId}
                onChange={(e) => setFileId(e.target.value)}
                placeholder="Enter MongoDB file ID"
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              />
              <button
                onClick={handleStreamPdf}
                disabled={loading}
                className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                Stream PDF
              </button>
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-100 dark:bg-red-900 border border-red-400 dark:border-red-600 text-red-700 dark:text-red-200 rounded">
              {error}
            </div>
          )}

          {/* Available Documents */}
          <div>
            <h2 className="text-xl font-semibold mb-3">Available Documents</h2>
            <div className="max-h-96 overflow-y-auto space-y-2">
              {documents.length === 0 ? (
                <p className="text-gray-500 dark:text-gray-400">No documents found</p>
              ) : (
                documents.map((doc) => (
                  <div
                    key={doc.file_id}
                    onClick={() => handleSelectDocument(doc)}
                    className="p-3 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer transition-colors"
                  >
                    <div className="font-medium text-gray-900 dark:text-gray-100">
                      {doc.filename || 'Unnamed file'}
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      ID: {doc.file_id.substring(0, 24)}...
                    </div>
                    {doc.metadata?.description && (
                      <div className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                        {doc.metadata.description}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* PDF Viewer */}
        <div>
          <h2 className="text-xl font-semibold mb-3">PDF Viewer</h2>
          <div className="border border-gray-300 dark:border-gray-600 rounded-md overflow-hidden bg-gray-100 dark:bg-gray-800">
            {pdfUrl ? (
              <iframe
                src={pdfUrl}
                className="w-full h-[600px] border-0"
                title="PDF Viewer"
              />
            ) : (
              <div className="w-full h-[600px] flex items-center justify-center text-gray-500 dark:text-gray-400">
                <p>Enter a file ID and click "Stream PDF" to view</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
