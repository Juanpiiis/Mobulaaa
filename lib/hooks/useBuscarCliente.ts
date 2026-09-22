'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useDebounce } from './useDebounce'
import type { Cliente, EstadoBusquedaCliente } from '@/types/clientes'

export function useBuscarCliente(ccNit: string) {
    const supabase = createClient()
    const [cliente, setCliente] = useState<Cliente | null>(null)
    const [estado, setEstado] = useState<EstadoBusquedaCliente>('idle')
    const [error, setError] = useState<string | null>(null)

    const debouncedCC = useDebounce(ccNit.trim(), 400)
    const requestIdRef = useRef(0)

    useEffect(() => {
        if (!debouncedCC) {
            setCliente(null)
            setEstado('idle')
            setError(null)
            return
        }

        if (debouncedCC.length < 3) {
            setCliente(null)
            setEstado('escribiendo')
            return
        }

        const currentRequestId = ++requestIdRef.current

        const buscar = async () => {
            setEstado('buscando')
            setError(null)

            try {
                const { data, error: err } = await supabase
                    .from('clientes')
                    .select('*')
                    .eq('cc_nit', debouncedCC)
                    .eq('activo', true)
                    .maybeSingle()

                if (currentRequestId !== requestIdRef.current) return

                if (err) {
                    setError('Error al buscar cliente')
                    setEstado('error')
                    setCliente(null)
                    return
                }

                if (data) {
                    setCliente(data as Cliente)
                    setEstado('encontrado')
                } else {
                    setCliente(null)
                    setEstado('no_encontrado')
                }
            } catch {
                if (currentRequestId !== requestIdRef.current) return
                setError('Error al buscar cliente')
                setEstado('error')
                setCliente(null)
            }
        }

        buscar()
    }, [debouncedCC, supabase])

    useEffect(() => {
        if (ccNit && ccNit.trim() !== debouncedCC) {
            setEstado(ccNit.trim().length >= 3 ? 'escribiendo' : 'idle')
        }
    }, [ccNit, debouncedCC])

    return { cliente, estado, error }
}