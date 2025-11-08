import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/reviewer/')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/reviewer/"!</div>
}
