import { createRootRoute, Outlet } from '@tanstack/react-router'
import { Navbar } from '../components/Navbar'

export const Route = createRootRoute({
  component: () => (
    <div className="min-h-screen bg-gray-50 flex">
      <Navbar />
      <main className="flex-1 ml-48 py-6 px-8">
        <Outlet />
      </main>
    </div>
  ),
})

