import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { apiService } from '../upload/api'
import type { Document } from '../upload/types'
import { StatusBadge } from '../upload/components/StatusBadge'

export const Route = createFileRoute('/reviewer/queue')({
  component: QueueComponent,
})

function QueueComponent() {
  const [documents, setDocuments] = useState<Document[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isQueueCollapsed, setIsQueueCollapsed] = useState(false)
  const [isFinishedCollapsed, setIsFinishedCollapsed] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    const fetchDocuments = async () => {
      try {
        setIsLoading(true)
        const response = await apiService.getDocuments(100) // Fetch up to 100 documents
        setDocuments(response.files)
      } catch (err) {
        console.error('Failed to fetch documents:', err)
      } finally {
        setIsLoading(false)
      }
    }

    fetchDocuments()
  }, [])

  const handleDocumentClick = (document: Document) => {
    navigate({
      to: '/reviewer/review',
      search: { docid: document.file_id },
    })
  }

  const formatFileSize = (bytes?: number): string => {
    if (!bytes) return 'N/A'
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
  }

  const formatDate = (dateString?: string): string => {
    if (!dateString) return 'N/A'
    try {
      return new Date(dateString).toLocaleString()
    } catch {
      return 'N/A'
    }
  }

  // Split documents into queue and finished
  const queueDocuments = documents.filter(
    (doc) => {
      const status = doc.metadata?.status || ''
      return status === 'pending_classification'
    }
  )
  const finishedDocuments = documents.filter(
    (doc) => {
      const status = doc.metadata?.status || ''
      return status !== 'pending_classification'
    }
  )

  const renderDocumentTable = (docs: Document[], emptyMessage: string) => {
    return (
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Filename
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Upload Date
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Size
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Category
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                AI Sensitivity
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            <AnimatePresence mode="popLayout">
              {isLoading ? (
                <motion.tr
                  key="loading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                    <motion.div
                      className="flex flex-col items-center justify-center gap-3"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.3 }}
                    >
                      <motion.div
                        className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full"
                        animate={{ rotate: 360 }}
                        transition={{
                          duration: 1,
                          repeat: Infinity,
                          ease: 'linear',
                        }}
                      />
                      <span>Loading documents...</span>
                    </motion.div>
                  </td>
                </motion.tr>
              ) : docs.length === 0 ? (
                <motion.tr
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                    {emptyMessage}
                  </td>
                </motion.tr>
              ) : (
                docs.map((doc, index) => (
                  <motion.tr
                    key={doc.file_id}
                    initial={{ opacity: 0, y: 10, backgroundColor: 'rgb(255 255 255)' }}
                    animate={{ opacity: 1, y: 0, backgroundColor: 'rgb(255 255 255)' }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{
                      duration: 0.3,
                      delay: index * 0.03,
                      ease: 'easeOut',
                    }}
                    onClick={() => handleDocumentClick(doc)}
                    whileHover={{
                      backgroundColor: 'rgb(239 246 255)',
                      transition: { duration: 0.15, ease: 'easeOut' },
                    }}
                    className="cursor-pointer bg-white"
                  >
                    <td className="px-4 py-4 text-sm font-medium text-gray-900">
                      {doc.filename || 'Unknown'}
                    </td>
                    <td className="px-4 py-4 text-sm">
                      <motion.div
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ delay: index * 0.03 + 0.1 }}
                      >
                        <StatusBadge
                          status={doc.metadata?.status || 'in_queue'}
                        />
                      </motion.div>
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-500">
                      {formatDate(doc.upload_date)}
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-500">
                      {formatFileSize(doc.length)}
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-500">
                      {doc.metadata?.category || 'N/A'}
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-500">
                      {doc.metadata?.ai_classified_sensitivity || 'N/A'}
                    </td>
                  </motion.tr>
                ))
              )}
            </AnimatePresence>
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <motion.div
      className="min-h-screen bg-gray-50"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <motion.div
          className="mb-6"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          <h1 className="text-3xl font-bold text-gray-900">Document Review Queue</h1>
          <p className="mt-1 text-sm text-gray-600">Click on a document to review and annotate</p>
        </motion.div>

        {/* Document Queue Section */}
        <motion.div
          className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6"
          initial={{ opacity: 0, y: 20, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.4, delay: 0.2 }}
        >
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 flex-1">
                <button
                  onClick={() => setIsQueueCollapsed(!isQueueCollapsed)}
                  className="text-gray-500 hover:text-gray-700 transition-colors"
                >
                  <svg
                    className={`w-5 h-5 transition-transform ${isQueueCollapsed ? 'rotate-0' : 'rotate-90'}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
                <motion.h2
                  className="text-lg font-semibold text-gray-900"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.3, delay: 0.3 }}
                >
                  Document Queue
                  <span className="ml-2 text-sm font-normal text-gray-500">
                    ({queueDocuments.length} {queueDocuments.length === 1 ? 'document' : 'documents'})
                  </span>
                </motion.h2>
              </div>
              <div className="flex items-center gap-2">
                <button
                  className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
                  title="Upload"
                  onClick={(e) => e.stopPropagation()}
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                    />
                  </svg>
                </button>
                <button
                  className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
                  title="More options"
                  onClick={(e) => e.stopPropagation()}
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"
                    />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          <AnimatePresence>
            {!isQueueCollapsed && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="overflow-hidden"
              >
                {renderDocumentTable(queueDocuments, 'No documents found in the queue.')}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Finished Documents Section */}
        <motion.div
          className="bg-white rounded-lg shadow-sm border border-gray-200"
          initial={{ opacity: 0, y: 20, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.4, delay: 0.3 }}
        >
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 flex-1">
                <button
                  onClick={() => setIsFinishedCollapsed(!isFinishedCollapsed)}
                  className="text-gray-500 hover:text-gray-700 transition-colors"
                >
                  <svg
                    className={`w-5 h-5 transition-transform ${isFinishedCollapsed ? 'rotate-0' : 'rotate-90'}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
                <motion.h2
                  className="text-lg font-semibold text-gray-900"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.3, delay: 0.4 }}
                >
                  Finished Documents
                  <span className="ml-2 text-sm font-normal text-gray-500">
                    ({finishedDocuments.length} {finishedDocuments.length === 1 ? 'document' : 'documents'})
                  </span>
                </motion.h2>
              </div>
              <div className="flex items-center gap-2">
                <button
                  className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
                  title="Upload"
                  onClick={(e) => e.stopPropagation()}
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                    />
                  </svg>
                </button>
                <button
                  className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
                  title="More options"
                  onClick={(e) => e.stopPropagation()}
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"
                    />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          <AnimatePresence>
            {!isFinishedCollapsed && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="overflow-hidden"
              >
                {renderDocumentTable(finishedDocuments, 'No finished documents found.')}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </motion.div>
  )
}

