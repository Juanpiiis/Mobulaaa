'use client'
import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Notificacion {
  id: string
  mensaje: string
  tipo: 'pedido' | 'stock' | 'movimiento'
  leida: boolean
  fecha: string
}

interface NotificacionesContextType {
  notificaciones: Notificacion[]
  noLeidas: number
  marcarLeida: (id: string) => void
  marcarTodasLeidas: () => void
}

const NotificacionesContext = createContext<NotificacionesContextType>({
  notificaciones: [],
  noLeidas: 0,
  marcarLeida: () => {},
  marcarTodasLeidas: () => {}
})

export function NotificacionesProvider({ children, rol, userId }: { children: ReactNode; rol: string; userId: string }) {
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([])
  const [popup, setPopup] = useState<string | null>(null)
  const supabase = createClient()

  const agregarNotificacion = (mensaje: string) => {
    const nueva: Notificacion = {
      id: Date.now().toString(),
      mensaje,
      tipo: 'pedido',
      leida: false,
      fecha: new Date().toISOString()
    }
    setNotificaciones(prev => [nueva, ...prev])
    setPopup(mensaje)
    setTimeout(() => setPopup(null), 4000)
  }

  useEffect(() => {
    if (!rol || !userId) return

    const channel = supabase
      .channel('realtime-notificaciones-' + userId)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'pedidos' }, () => {
        if (rol === 'bodeguero' || rol === 'admin') {
          agregarNotificacion('🛒 Nuevo pedido recibido')
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'pedidos' }, (payload) => {
        const nuevo = payload.new
        const viejo = payload.old

        if (viejo.estado === nuevo.estado) return

        // Notificar al bodeguero cuando cartera aprueba
        if (rol === 'bodeguero' && nuevo.estado === 'aprobado_cartera') {
          agregarNotificacion('✅ Pedido aprobado por cartera — listo para despachar')
        }

        // Notificar a cartera cuando bodeguero aprueba
        if (rol === 'cartera' && nuevo.estado === 'aprobado_bodega') {
          agregarNotificacion('📋 Nuevo pedido aprobado por bodega — pendiente revisión')
        }

        // Notificar al vendedor según el estado
        if (rol === 'vendedor') {
          if (nuevo.vendedor_id !== userId) return
          const mensajes: Record<string, string> = {
            aprobado_bodega: '📦 Tu pedido fue revisado por bodega',
            rechazado_bodega: '❌ Tu pedido fue rechazado por bodega',
            aprobado_cartera: '✅ Tu pedido fue aprobado — en camino',
            rechazado_cartera: '❌ Tu pedido fue rechazado por cartera',
            despachado: '🚚 Tu pedido fue despachado',
            entregado: '🎉 Tu pedido fue entregado'
          }
          if (mensajes[nuevo.estado]) agregarNotificacion(mensajes[nuevo.estado])
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'detalle_pedido' }, () => {
        if (rol === 'vendedor') {
          agregarNotificacion('✏️ El bodeguero modificó las cantidades de tu pedido')
        }
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [rol, userId])

  const marcarLeida = (id: string) => setNotificaciones(prev => prev.map(n => n.id === id ? { ...n, leida: true } : n))
  const marcarTodasLeidas = () => setNotificaciones(prev => prev.map(n => ({ ...n, leida: true })))
  const noLeidas = notificaciones.filter(n => !n.leida).length

  return (
    <NotificacionesContext.Provider value={{ notificaciones, noLeidas, marcarLeida, marcarTodasLeidas }}>
      {children}
      {popup && (
        <div className="fixed bottom-6 right-6 bg-gray-900 text-white px-4 py-3 rounded-lg shadow-lg z-50 flex items-center gap-3 max-w-sm">
          <span className="text-sm">{popup}</span>
          <button onClick={() => setPopup(null)} className="text-gray-400 hover:text-white ml-2">✕</button>
        </div>
      )}
    </NotificacionesContext.Provider>
  )
}

export const useNotificaciones = () => useContext(NotificacionesContext)