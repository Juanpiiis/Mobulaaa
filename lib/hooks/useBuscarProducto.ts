'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useDebounce } from './useDebounce'

export interface ProductoBusqueda {
    id: string
    nombre: string
    precio: number
    categoria: string | null
    sku: string | null
    stock_disponible: number
}

export function useBuscarProducto(
    termino: string,
    bodegaId: string | undefined,
    productosBase: ProductoBusqueda[]
) {
    const supabase = createClient()
    const [resultados, setResultados] = useState<ProductoBusqueda[]>([])
    const [buscando, setBuscando] = useState(false)

    const debounced = useDebounce(termino.trim(), 300)
    const requestIdRef = useRef(0)

    useEffect(() => {
        if (!debounced || debounced.length < 2) {
            setResultados(productosBase.slice(0, 10))
            setBuscando(false)
            return
        }

        const currentRequestId = ++requestIdRef.current
        setBuscando(true)

        const buscar = async () => {
            try {
                const { data } = await supabase
                    .from('inventario')
                    .select(`
    cantidad_disponible,
    productos!inner(id, nombre, precio, categoria, sku)
  `)
                    .eq('bodega_id', bodegaId)
                    .gt('cantidad_disponible', 0)
                    .ilike('productos.nombre', `%${debounced}%`)
                    .limit(15)
                if (currentRequestId !== requestIdRef.current) return

                const items: ProductoBusqueda[] =
                    data
                        ?.map((i: any) => ({
                            ...i.productos,
                            stock_disponible: i.cantidad_disponible || 0,
                        }))
                        .filter((p: any) => p.id) || []

                setResultados(items)
            } catch {
                if (currentRequestId !== requestIdRef.current) return
                setResultados([])
            } finally {
                if (currentRequestId === requestIdRef.current) setBuscando(false)
            }
        }

        buscar()
    }, [debounced, bodegaId, supabase, productosBase])

    return { resultados, buscando }
}