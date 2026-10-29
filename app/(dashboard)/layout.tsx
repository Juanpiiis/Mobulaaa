'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { NotificacionesProvider } from '@/lib/context/NotificacionesContext'
import { ProvidersWithKey } from '@/components/ProvidersWithKey'
import DashboardContent from '@/components/dashboard/DashboardContent'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [rol, setRol] = useState('')
  const [loading, setLoading] = useState(true)
  const [bodegasAsignadas, setBodegasAsignadas] = useState<string[] | null>(null)
  const router = useRouter()

  // Al usar el Singleton, esto ya no creará instancias duplicadas
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
          .select('rol, id, activo')
          .eq('id', session.user.id)
          .single()

        if (error || !userData) {
          router.push('/login')
          return
        }

        if (!userData.activo) {
          await supabase.auth.signOut()
          router.push('/login?error=inactivo')
          return
        }

        setRol(userData.rol || '')

        if (userData.rol === 'admin') {
          setBodegasAsignadas([])
          return
        }

        const { data: bodegasData, error: bodegasError } = await supabase
          .from('usuario_bodegas')
          .select('bodega_id')
          .eq('usuario_id', session.user.id)

        if (bodegasError) {
          console.error('Error al cargar bodegas del usuario:', bodegasError.message)
        }

        setBodegasAsignadas(bodegasData?.map(b => b.bodega_id) || [])

      } catch (error) {
        console.error('Error en checkAuth:', error)
        router.push('/login')
      } finally {
        // 🔥 ESTO ES LO QUE FALTABA: Pase lo que pase, quitamos el "Cargando panel..."
        setLoading(false)
      }
    }

    checkAuth()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div className="loading-screen min-h-[100dvh]">
        <div className="loading-screen__inner">
          <div className="loading-screen__spinner"></div>
          <p className="loading-screen__text">Cargando panel...</p>
        </div>
      </div>
    )
  }

  // ✅ BLOQUEO: Rol no-admin sin bodegas
  if (rol !== 'admin' && bodegasAsignadas !== null && bodegasAsignadas.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
        <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8 text-center">
          <div className="text-5xl mb-4">🏭</div>
          <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-2">
            Sin bodega asignada
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            No tienes una bodega asignada. Pídele al administrador que te asigne una para poder operar.
          </p>
          <button
            onClick={async () => {
              await supabase.auth.signOut()
              router.push('/login')
            }}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2.5 px-4 rounded-xl transition-colors"
          >
            Cerrar sesión
          </button>
        </div>
      </div>
    )
  }

  return (
    <ProvidersWithKey>
      <NotificacionesProvider>
        <DashboardContent rol={rol}>
          {children}
        </DashboardContent>
      </NotificacionesProvider>
    </ProvidersWithKey>
  )
}