'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { NotificacionesProvider } from '@/lib/context/NotificacionesContext'
import DashboardContent from '@/components/dashboard/DashboardContent'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [rol, setRol] = useState('')
  const [userId, setUserId] = useState('')
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        
        if (!session) {
          router.push('/login')
          return
        }

        const { data: userData, error } = await supabase
          .from('usuarios')
          .select('rol, id')
          .eq('id', session.user.id)
          .single()

        if (error || !userData) {
          router.push('/login')
          return
        }

        setRol(userData.rol || '')
        setUserId(session.user.id)
        setLoading(false)

      } catch (error) {
        router.push('/login')
      }
    }

    checkAuth()
  }, [])

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-screen__inner">
          <div className="loading-screen__spinner"></div>
          <p className="loading-screen__text">Cargando panel...</p>
        </div>
      </div>
    )
  }

  return (
    <NotificacionesProvider rol={rol} userId={userId}>
      <DashboardContent rol={rol}>
        {children}
      </DashboardContent>
    </NotificacionesProvider>
  )
}