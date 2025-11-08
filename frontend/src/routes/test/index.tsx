import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/test/')({
  component: Test,
})

function Test() {
  return (
    <div className="max-w-5xl mx-auto p-8">
      <h1 className="text-4xl font-bold mb-4">Test Page</h1>
      <p className="text-gray-600">
        This is a test page using TanStack Router with file-based routing.
      </p>
    </div>
  )
}
