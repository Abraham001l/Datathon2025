import { createFileRoute, Navigate } from '@tanstack/react-router'

export const Route = createFileRoute('/reviewer/')({
  component: RouteComponent,
})

function RouteComponent() {
  return <Navigate to="/reviewer/queue" />
}
