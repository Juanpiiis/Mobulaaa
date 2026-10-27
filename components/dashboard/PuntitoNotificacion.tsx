'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useTienda } from '@/lib/context/TiendaContext'
import { usePathname } from 'next/navigation'

export function PuntitoNotificacion({ rol }: { rol: string }) {
    const [hayNuevo, setHayNuevo] = useState(false)
    const { tiendaActual } = useTienda()
    const supabase = createClient()
    const pathname = usePathname()

    const cantidadActualRef = useRef(0)
    const estasEnLaPaginaRef = useRef(false)

    const rutaDestino =
        rol === 'cartera' ? '/cartera' :
            rol === 'bodeguero' ? '/bodeguero/pedidos' :
                rol === 'admin' ? '/admin/pedidos' :
                    '/vendedor/mis-pedidos'

    const estasEnLaPagina = pathname === rutaDestino
    estasEnLaPaginaRef.current = estasEnLaPagina

    const storageKey = `pedidos_vistos_${rol}_${tiendaActual?.id || 'global'}`

    useEffect(() => {
        if (!tiendaActual && rol !== 'cartera') return

        // 🔥 Generamos un nombre único de canal para evitar el error de React Strict Mode
        const channelName = `badge-${rol}-${tiendaActual?.id || 'global'}-${Math.random().toString(36).substring(7)}`

        let channel: any = null

        const iniciarRealtime = async () => {
            // 1. Funcion para contar
            const contarPedidos = async (): Promise<number> => {
                let query = supabase.from('pedidos').select('*', { count: 'exact', head: true })

                if (rol === 'cartera') {
                    query = query.eq('estado', 'pendiente')
                } else if (rol === 'admin') {
                    query = query.in('estado', ['pendiente', 'aprobado_cartera']).eq('bodega_id', tiendaActual?.id)
                } else if (rol === 'bodeguero') {
                    query = query.eq('estado', 'aprobado_cartera').eq('bodega_id', tiendaActual?.id)
                } else if (rol === 'vendedor') {
                    const { data: { user } } = await supabase.auth.getUser()
                    query = query.eq('estado', 'aprobado_cartera').eq('bodega_id', tiendaActual?.id).eq('vendedor_id', user?.id)
                }

                const { count, error } = await query
                if (error) console.error("Error contando:", error)
                return count || 0
            }

            // 2. Funcion para revisar estado
            const revisarEstado = async () => {
                const totalEnBD = await contarPedidos()
                cantidadActualRef.current = totalEnBD

                if (estasEnLaPaginaRef.current) {
                    setHayNuevo(false)
                    localStorage.setItem(storageKey, totalEnBD.toString())
                    return
                }

                const totalVisto = parseInt(localStorage.getItem(storageKey) || '0', 10)
                setHayNuevo(totalEnBD > totalVisto)
            }

            // Revisión inicial
            revisarEstado()

            // 3. Configurar canal con nombre ÚNICO
            const filtro = rol === 'cartera' ? undefined : `bodega_id=eq.${tiendaActual?.id}`

            channel = supabase
                .channel(channelName)
                .on(
                    'postgres_changes',
                    { event: '*', schema: 'public', table: 'pedidos', filter: filtro },
                    () => setTimeout(revisarEstado, 500)
                )
                .subscribe()
        }

        iniciarRealtime()

        // Limpieza del canal
        return () => {
            if (channel) {
                supabase.removeChannel(channel)
            }
        }
    }, [rol, tiendaActual?.id, supabase, storageKey])

    useEffect(() => {
        if (estasEnLaPagina) {
            setHayNuevo(false)
            localStorage.setItem(storageKey, cantidadActualRef.current.toString())
        }
    }, [estasEnLaPagina, storageKey])

    if (!hayNuevo || estasEnLaPagina) return null

    return (
        <span className="ml-2 relative flex h-3 w-3 z-50">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
        </span>
    )
}