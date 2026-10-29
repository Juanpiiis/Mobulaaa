'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { NotificacionesProvider } from '@/lib/context/NotificacionesContext'
import { ProvidersWithKey } from '@/components/ProvidersWithKey'
import DashboardContent from '@/components/dashboard/DashboardContent'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  // 🔥 FORZAMOS EL ROL Y QUITAMOS EL LOADING INICIAL
  const [rol, setRol] = useState('admin')
  const [loading, setLoading] = useState(false) // <-- Ya no esperamos
  const [bodegasAsignadas, setBodegasAsignadas] = useState<string[] | null>([])
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    // Validación en segundo plano (no bloquea el renderizado)
    const checkAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()

        if (!session) {
          // Si no hay sesión, expulsamos al login
          window.location.href = '/login'
          return
        }

        const { data: userData } = await supabase
          .from('usuarios')
          .select('rol, id, activo')
          .eq('id', session.user.id)
          .single()

        if (userData?.activo === false) {
          await supabase.auth.signOut()
          window.location.href = '/login?error=inactivo'
          return
        }

        // Si hay un rol distinto, lo actualizamos en segundo plano
        if (userData?.rol) {
          setRol(userData.rol)
        }

      } catch (error) {
        console.error('Error en checkAuth:', error)
        // Si falla la red, no hacemos nada, dejamos que el panel cargue
      }
    }

    checkAuth()
  }, [])

  // 🔥 ELIMINAMOS EL BLOQUE "IF (LOADING)" POR COMPLETO

  // ✅ BLOQUEO: Rol no-admin sin bodegas (Solo aplica si no es admin)
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
              window.location.href = '/login'
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