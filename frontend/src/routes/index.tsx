import { createFileRoute } from '@tanstack/react-router'
export const Route = createFileRoute('/')({
  component: Home,
})

function Home() {

  return (
    <div className="w-full max-w-full text-center">
      Hello
    </div>
  )
}
