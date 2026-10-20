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

        const contarPedidos = async (): Promise<number> => {
            let query = supabase.from('pedidos').select('*', { count: 'exact', head: true })

            // 🔥 LÓGICA CORREGIDA SEGÚN EL FLUJO
            if (rol === 'cartera') {
                query = query.eq('estado', 'pendiente')
            } else if (rol === 'admin') {
                // Admin ve todos los pendientes y aprobados de su bodega
                query = query.in('estado', ['pendiente', 'aprobado_cartera']).eq('bodega_id', tiendaActual?.id)
            } else if (rol === 'bodeguero') {
                // Bodega SOLO ve los aprobados por cartera
                query = query.eq('estado', 'aprobado_cartera').eq('bodega_id', tiendaActual?.id)
            } else if (rol === 'vendedor') {
                // Vendedor ve cuando cartera le aprueba su pedido
                const { data: { user } } = await supabase.auth.getUser()
                query = query.eq('estado', 'aprobado_cartera').eq('bodega_id', tiendaActual?.id).eq('vendedor_id', user?.id)
            }

            const { count, error } = await query
            if (error) console.error("Error contando:", error)
            return count || 0
        }

        const revisarEstado = async () => {
            const totalEnBD = await contarPedidos()
            cantidadActualRef.current = totalEnBD

            if (estasEnLaPaginaRef.current) {
                setHayNuevo(false)
                localStorage.setItem(storageKey, totalEnBD.toString())
                return
            }

            const totalVisto = parseInt(localStorage.getItem(storageKey) || '0', 10)

            if (totalEnBD > totalVisto) {
                setHayNuevo(true)
            } else {
                setHayNuevo(false)
            }
        }

        revisarEstado()

        const filtro = rol === 'cartera' ? undefined : `bodega_id=eq.${tiendaActual?.id}`

        const channel = supabase
            .channel(`badge-${rol}`)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'pedidos', filter: filtro },
                () => setTimeout(revisarEstado, 500)
            )
            .subscribe()

        return () => { supabase.removeChannel(channel) }
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