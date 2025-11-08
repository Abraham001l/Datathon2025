import { createRootRoute, Outlet } from '@tanstack/react-router'

export const Route = createRootRoute({
  component: () => (
    <div className="min-h-screen bg-gray-50">
      <main className="w-full py-6">
        <Outlet />
      </main>
    </div>
  ),
})

