import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'

export const Route = createFileRoute('/gooftest/')({
  component: RouteComponent,
})

function RouteComponent() {
  // get document images
  
  return <div>Hello "/gooftest/"!</div>
}
