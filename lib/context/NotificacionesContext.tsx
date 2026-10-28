'use client'
import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Notificacion {
  id: string
  usuario_id: string
  tipo: string
  titulo: string
  mensaje: string
  link: string | null
  leida: boolean
  created_at: string
}

interface NotificacionesContextType {
  notificaciones: Notificacion[]
  noLeidas: number
  marcarLeida: (id: string) => Promise<void>
  marcarTodasLeidas: () => Promise<void>
}

const NotificacionesContext = createContext<NotificacionesContextType>({
  notificaciones: [],
  noLeidas: 0,
  marcarLeida: async () => { },
  marcarTodasLeidas: async () => { },
})

export function NotificacionesProvider({ children }: { children: ReactNode }) {
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([])
  const [popup, setPopup] = useState<string | null>(null)
  const supabase = createClient()

  const cargar = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data } = await supabase
      .from('notificaciones')
      .select('*')
      .eq('usuario_id', user.id)
      .order('created_at', { ascending: false })
      .limit(30)

    if (data) setNotificaciones(data)
  }

  useEffect(() => {
    cargar()

    let channel: any = null

    const setupRealtime = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // 🔥 Generamos un nombre de canal único para evitar el error de React Strict Mode
      const channelName = `notificaciones-${user.id}-${Math.random().toString(36).substring(7)}`

      channel = supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'notificaciones', filter: `usuario_id=eq.${user.id}` },
          (payload) => {
            const nueva = payload.new as Notificacion
            setNotificaciones((prev) => [nueva, ...prev])
            setPopup(nueva.titulo + ': ' + nueva.mensaje)
            setTimeout(() => setPopup(null), 5000)
          }
        )
        .subscribe()
    }

    setupRealtime()

    // Refrescar al volver a la pestaña (útil en WebView)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') cargar()
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      if (channel) supabase.removeChannel(channel)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [supabase])

  const marcarLeida = async (id: string) => {
    setNotificaciones((prev) => prev.map((n) => (n.id === id ? { ...n, leida: true } : n)))
    await supabase.from('notificaciones').update({ leida: true }).eq('id', id)
  }

  const marcarTodasLeidas = async () => {
    setNotificaciones((prev) => prev.map((n) => ({ ...n, leida: true })))
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await supabase.from('notificaciones').update({ leida: true }).eq('usuario_id', user.id)
    }
  }

  const noLeidas = notificaciones.filter((n) => !n.leida).length

  return (
    <NotificacionesContext.Provider value={{ notificaciones, noLeidas, marcarLeida, marcarTodasLeidas }}>
      {children}
      {popup && (
        <div className="fixed bottom-6 right-6 bg-[#1A0087] text-white px-4 py-3 rounded-xl shadow-2xl z-[100] flex items-center gap-3 max-w-sm animate-in slide-in-from-bottom-4">
          <span className="text-sm font-medium">{popup}</span>
          <button onClick={() => setPopup(null)} className="text-white/60 hover:text-white ml-2">✕</button>
        </div>
      )}
    </NotificacionesContext.Provider>
  )
}

export const useNotificaciones = () => useContext(NotificacionesContext)