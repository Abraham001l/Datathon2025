import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { API_BASE_URL } from '../utils/apiConfig'

interface Document {
  file_id: string
  filename: string
  upload_date: string | null
  length: number
  content_type: string
  metadata: {
    description: string | null
    category: string | null
    status: string | null
    ai_classified_sensitivity: string | null
  }
}

interface DashboardStats {
  totalDocuments: number
  pendingReview: number
  inProgress: number
  completed: number
  recentDocuments: Document[]
}

export const Route = createFileRoute('/')({
  component: Home,
})

function Home() {
  const [stats, setStats] = useState<DashboardStats>({
    totalDocuments: 0,
    pendingReview: 0,
    inProgress: 0,
    completed: 0,
    recentDocuments: [],
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/view/document?limit=100`)
        if (!response.ok) throw new Error('Failed to fetch documents')
        
        const data = await response.json()
        const documents: Document[] = data.files || []

        const totalDocuments = documents.length
        const pendingReview = documents.filter(
          (doc) => doc.metadata?.status === 'pending_classification' || !doc.metadata?.status
        ).length
        const inProgress = documents.filter(
          (doc) => doc.metadata?.status === 'in_review' || doc.metadata?.status === 'processing'
        ).length
        const completed = documents.filter(
          (doc) => doc.metadata?.status === 'reviewed' || doc.metadata?.status === 'completed'
        ).length

        const recentDocuments = documents
          .sort((a, b) => {
            const dateA = a.upload_date ? new Date(a.upload_date).getTime() : 0
            const dateB = b.upload_date ? new Date(b.upload_date).getTime() : 0
            return dateB - dateA
          })
          .slice(0, 5)

        setStats({
          totalDocuments,
          pendingReview,
          inProgress,
          completed,
          recentDocuments,
        })
      } catch (error) {
        console.error('Error fetching dashboard data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchDashboardData()
  }, [])

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A'
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    } catch {
      return 'N/A'
    }
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
          className="mb-4"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          <h1 className="text-4xl font-bold text-blue-800">Welcome!</h1>
          <p className="mt-1 text-sm">
            You're working under <span className="text-blue-600 bg-gray-200 rounded-md px-1.5 py-0.5">datathon-documents</span>
          </p>
        </motion.div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-4">
          {/* Total Documents */}
          <motion.div
            className="bg-white overflow-hidden shadow-sm rounded-lg border border-gray-200"
            initial={{ opacity: 0, y: 20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.4, delay: 0.2 }}
            whileHover={{ scale: 1.02 }}
          >
            <div className="p-4">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                    <svg
                      className="w-6 h-6 text-gray-600"
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
                </div>
                <div className="ml-4 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Total Documents
                    </dt>
                    <dd className="flex items-baseline">
                      <div className="text-2xl font-semibold text-gray-900">
                        {loading ? '...' : stats.totalDocuments}
                      </div>
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Pending Review */}
          <motion.div
            className="bg-white overflow-hidden shadow-sm rounded-lg border border-gray-200"
            initial={{ opacity: 0, y: 20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.4, delay: 0.25 }}
            whileHover={{ scale: 1.02 }}
          >
            <div className="p-4">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                    <svg
                      className="w-6 h-6 text-gray-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </div>
                </div>
                <div className="ml-4 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Pending Review
                    </dt>
                    <dd className="flex items-baseline">
                      <div className="text-2xl font-semibold text-gray-900">
                        {loading ? '...' : stats.pendingReview}
                      </div>
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </motion.div>

          {/* In Progress */}
          <motion.div
            className="bg-white overflow-hidden shadow-sm rounded-lg border border-gray-200"
            initial={{ opacity: 0, y: 20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.4, delay: 0.3 }}
            whileHover={{ scale: 1.02 }}
          >
            <div className="p-4">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                    <svg
                      className="w-6 h-6 text-gray-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                      />
                    </svg>
                  </div>
                </div>
                <div className="ml-4 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      In Progress
                    </dt>
                    <dd className="flex items-baseline">
                      <div className="text-2xl font-semibold text-gray-900">
                        {loading ? '...' : stats.inProgress}
                      </div>
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Completed */}
          <motion.div
            className="bg-white overflow-hidden shadow-sm rounded-lg border border-gray-200"
            initial={{ opacity: 0, y: 20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.4, delay: 0.35 }}
            whileHover={{ scale: 1.02 }}
          >
            <div className="p-4">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                    <svg
                      className="w-6 h-6 text-gray-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </div>
                </div>
                <div className="ml-4 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Completed
                    </dt>
                    <dd className="flex items-baseline">
                      <div className="text-2xl font-semibold text-gray-900">
                        {loading ? '...' : stats.completed}
                      </div>
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Recommendations Section */}
        <motion.div
          className="mb-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.5 }}
        >
          <div className="bg-white shadow-sm rounded-lg border border-gray-200">
            <div className="p-4">
              <h2 className="text-lg font-semibold text-gray-900 mb-3">Recommendations</h2>
              <div className="space-y-2">
                {stats.pendingReview > 0 && (
                  <motion.div
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: 0.6 }}
                    className="flex items-start p-3 bg-gray-50 rounded-lg border border-gray-200"
                  >
                    <div className="flex-shrink-0">
                      <div className="w-8 h-8 bg-gray-200 rounded-lg flex items-center justify-center">
                        <svg
                          className="w-5 h-5 text-gray-600"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                      </div>
                    </div>
                    <div className="ml-4 flex-1">
                      <p className="text-sm font-medium text-gray-900">
                        You have documents that need review
                      </p>
                      <p className="text-sm text-gray-600 mt-1">
                        {stats.pendingReview} document{stats.pendingReview !== 1 ? 's' : ''} {stats.pendingReview === 1 ? 'is' : 'are'} waiting for review
                      </p>
                    </div>
                    <Link
                      to="/reviewer/queue"
                      className="ml-4 flex-shrink-0 text-sm font-medium text-gray-600 hover:text-gray-900"
                    >
                      Review now →
                    </Link>
                  </motion.div>
                )}
                {stats.totalDocuments === 0 && (
                  <motion.div
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: 0.65 }}
                    className="flex items-start p-3 bg-gray-50 rounded-lg border border-gray-200"
                  >
                    <div className="flex-shrink-0">
                      <div className="w-8 h-8 bg-gray-200 rounded-lg flex items-center justify-center">
                        <svg
                          className="w-5 h-5 text-gray-600"
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
                      </div>
                    </div>
                    <div className="ml-4 flex-1">
                      <p className="text-sm font-medium text-gray-900">
                        Get started by uploading your first document
                      </p>
                      <p className="text-sm text-gray-600 mt-1">
                        Upload documents to begin processing and review
                      </p>
                    </div>
                    <Link
                      to="/upload"
                      className="ml-4 flex-shrink-0 text-sm font-medium text-gray-600 hover:text-gray-900"
                    >
                      Upload now →
                    </Link>
                  </motion.div>
                )}
                {stats.totalDocuments > 0 && stats.inProgress > 0 && (
                  <motion.div
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: stats.pendingReview > 0 ? 0.65 : 0.6 }}
                    className="flex items-start p-3 bg-gray-50 rounded-lg border border-gray-200"
                  >
                    <div className="flex-shrink-0">
                      <div className="w-8 h-8 bg-gray-200 rounded-lg flex items-center justify-center">
                        <svg
                          className="w-5 h-5 text-gray-600"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                          />
                        </svg>
                      </div>
                    </div>
                    <div className="ml-4 flex-1">
                      <p className="text-sm font-medium text-gray-900">
                        Documents currently in progress
                      </p>
                      <p className="text-sm text-gray-600 mt-1">
                        {stats.inProgress} document{stats.inProgress !== 1 ? 's' : ''} {stats.inProgress === 1 ? 'is' : 'are'} being processed
                      </p>
                    </div>
                    <Link
                      to="/reviewer/queue"
                      className="ml-4 flex-shrink-0 text-sm font-medium text-gray-600 hover:text-gray-900"
                    >
                      View status →
                    </Link>
                  </motion.div>
                )}
                {stats.totalDocuments > 0 && stats.pendingReview === 0 && stats.inProgress === 0 && (
                  <motion.div
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: 0.6 }}
                    className="flex items-start p-3 bg-gray-50 rounded-lg border border-gray-200"
                  >
                    <div className="flex-shrink-0">
                      <div className="w-8 h-8 bg-gray-200 rounded-lg flex items-center justify-center">
                        <svg
                          className="w-5 h-5 text-gray-600"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                      </div>
                    </div>
                    <div className="ml-4 flex-1">
                      <p className="text-sm font-medium text-gray-900">
                        All documents are up to date
                      </p>
                      <p className="text-sm text-gray-600 mt-1">
                        Great job! All your documents have been reviewed
                      </p>
                    </div>
                  </motion.div>
                )}
              </div>
            </div>
          </div>
        </motion.div>

        {/* Quick Actions and Recent Documents */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Quick Actions */}
          <motion.div
            className="lg:col-span-1"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: 0.4 }}
          >
            <div className="bg-white shadow-sm rounded-lg border border-gray-200">
              <div className="p-4">
                <h2 className="text-lg font-semibold text-gray-900 mb-3">Quick Actions</h2>
                <div className="space-y-2">
                  <motion.div
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Link
                      to="/upload"
                      className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-gray-300 transition-colors group"
                    >
                      <div className="flex items-center">
                        <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center mr-3 group-hover:bg-gray-200 transition-colors">
                          <svg
                            className="w-4 h-4 text-gray-600"
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
                        </div>
                        <span className="text-sm font-medium text-gray-700">Upload Document</span>
                      </div>
                      <svg
                        className="w-5 h-5 text-gray-400 group-hover:text-gray-600"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                    </Link>
                  </motion.div>

                  <motion.div
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Link
                      to="/reviewer/queue"
                      className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-gray-300 transition-colors group"
                    >
                      <div className="flex items-center">
                        <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center mr-3 group-hover:bg-gray-200 transition-colors">
                          <svg
                            className="w-4 h-4 text-gray-600"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
                            />
                          </svg>
                        </div>
                        <span className="text-sm font-medium text-gray-700">Review Queue</span>
                      </div>
                      <svg
                        className="w-5 h-5 text-gray-400 group-hover:text-gray-600"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                    </Link>
                  </motion.div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Recent Documents */}
          <motion.div
            className="lg:col-span-2"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: 0.45 }}
          >
            <div className="bg-white shadow-sm rounded-lg border border-gray-200">
              <div className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-lg font-semibold text-gray-900">Recent Documents</h2>
                  <Link
                    to="/reviewer/queue"
                    className="text-sm text-gray-600 hover:text-gray-900"
                  >
                    View all
                  </Link>
                </div>
                <AnimatePresence mode="wait">
                  {loading ? (
                    <motion.div
                      key="loading"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="text-center py-8 text-gray-500"
                    >
                      Loading...
                    </motion.div>
                  ) : stats.recentDocuments.length === 0 ? (
                    <motion.div
                      key="empty"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="text-center py-8 text-gray-500"
                    >
                      <p>No documents yet</p>
                      <Link
                        to="/upload"
                        className="mt-2 inline-block text-sm text-gray-600 hover:text-gray-900 underline"
                      >
                        Upload your first document
                      </Link>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="documents"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.3 }}
                    >
                      <div className="space-y-2">
                        {stats.recentDocuments.map((doc, index) => (
                          <motion.div
                            key={doc.file_id}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.3, delay: index * 0.05 }}
                            whileHover={{ x: 4 }}
                            className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-gray-300 transition-colors group"
                          >
                            <div className="flex items-center flex-1 min-w-0">
                              <div className="flex-shrink-0 w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center mr-3">
                                <svg
                                  className="w-4 h-4 text-gray-600"
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
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium text-gray-900 truncate">
                                  {doc.filename}
                                </div>
                                <div className="flex items-center gap-2 mt-1">
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                                    {doc.metadata?.status || 'Pending'}
                                  </span>
                                  <span className="text-xs text-gray-500">
                                    {formatDate(doc.upload_date)}
                                  </span>
                                </div>
                              </div>
                            </div>
                            <svg
                              className="w-5 h-5 text-gray-400 group-hover:text-gray-600 flex-shrink-0 ml-2"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M9 5l7 7-7 7"
                              />
                            </svg>
                          </motion.div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </motion.div>
  )
}
