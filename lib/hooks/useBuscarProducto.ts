'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useDebounce } from './useDebounce'

export interface ProductoBusqueda {
    id: string
    nombre: string
    precio: number
    precio_mayorista: number | null // 🔥 AGREGADO
    categoria: string | null
    sku: string | null
    stock_disponible: number
    congelado_manual: boolean
    limite_congelado: number | null
}

const LIMITE_DEFAULT = 150

export function esProductoCongelado(p: ProductoBusqueda): boolean {
    if (p.congelado_manual) return true
    const limite = p.limite_congelado ?? LIMITE_DEFAULT
    if (limite === 0) return false
    return p.stock_disponible <= limite
}

export function motivoCongelado(p: ProductoBusqueda): string {
    if (p.congelado_manual) return 'Congelado manualmente'
    const limite = p.limite_congelado ?? LIMITE_DEFAULT
    return `Congelado (stock ${p.stock_disponible} ≤ ${limite})`
}

function sanearTermino(t: string): string {
    return t.replace(/[,()%*\\]/g, ' ').trim()
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
        const terminoLimpio = sanearTermino(debounced)

        if (!terminoLimpio || terminoLimpio.length < 2) {
            setResultados(productosBase)
            setBuscando(false)
            return
        }

        const currentRequestId = ++requestIdRef.current
        setBuscando(true)

        const buscar = async () => {
            try {
                const { data, error } = await supabase
                    .from('inventario')
                    .select(`
                        cantidad_disponible,
                        productos!inner(
                            id, 
                            nombre, 
                            precio, 
                            precio_mayorista, 
                            categoria, 
                            sku,
                            congelado_manual,
                            limite_congelado
                        )
                    `)
                    .eq('bodega_id', bodegaId)
                    .gt('cantidad_disponible', 0)
                    .or(`nombre.ilike.%${terminoLimpio}%,sku.ilike.%${terminoLimpio}%`, { foreignTable: 'productos' })
                    .limit(50)

                if (currentRequestId !== requestIdRef.current) return

                if (error) {
                    console.error('Error buscando productos:', error)
                    setResultados([])
                    return
                }

                const items: ProductoBusqueda[] =
                    data
                        ?.map((i: any) => ({
                            ...i.productos,
                            stock_disponible: i.cantidad_disponible || 0,
                            congelado_manual: i.productos.congelado_manual ?? false,
                            limite_congelado: i.productos.limite_congelado ?? null,
                        }))
                        .filter((p: any) => p.id) || []

                setResultados(items)
            } catch (e) {
                if (currentRequestId !== requestIdRef.current) return
                console.error('Error buscando productos:', e)
                setResultados([])
            } finally {
                if (currentRequestId === requestIdRef.current) setBuscando(false)
            }
        }

        buscar()
    }, [debounced, bodegaId, supabase, productosBase])

    return { resultados, buscando }
}