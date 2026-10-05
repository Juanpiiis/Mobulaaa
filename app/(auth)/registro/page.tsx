'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function RegistroPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/login')
  }, [router])

  return (
    <div className="flex-1 flex items-center justify-center min-h-[100dvh]">
      <p className="text-sm text-gray-500">Redirigiendo al login...</p>
    </div>
  )
}