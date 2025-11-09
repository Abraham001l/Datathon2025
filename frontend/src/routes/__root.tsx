import { createRootRoute, Outlet, useLocation } from '@tanstack/react-router'
import { Navbar } from '../components/Navbar'
import { TopNavbar } from '../components/TopNavbar'
import { SidebarProvider, useSidebar } from '../contexts/SidebarContext'

function RootComponent() {
  const { isCollapsed } = useSidebar()
  const location = useLocation()
  const isReviewScreen = location.pathname === '/reviewer/review'

  if (isReviewScreen) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Outlet />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <TopNavbar />
      <div className="flex flex-1 pt-14">
        <Navbar />
        <main className={`flex-1 py-6 px-8 transition-all duration-300 ${isCollapsed ? 'ml-0' : 'ml-48'}`}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export const Route = createRootRoute({
  component: () => (
    <SidebarProvider>
      <RootComponent />
    </SidebarProvider>
  ),
})

