'use client'
import { SupabaseClient } from '@supabase/supabase-js'
import { FiltrosStats, ESTADOS_VENTA } from './types'
import { calcularRangos, iso } from './fechas'

// 1. Margen por producto
export async function margenPorProducto(sb: SupabaseClient, f: FiltrosStats) {
    const { actual } = calcularRangos(f)

    let q = sb
        .from('pedidos')
        .select('detalle_pedido(cantidad_aprobada, precio_unitario, producto_id, productos(nombre, precio, precio_mayorista))')
        .in('estado', ESTADOS_VENTA)
        .gte('fecha', iso(actual.desde))
        .lte('fecha', iso(actual.hasta))

    if (f.bodegaId) q = q.eq('bodega_id', f.bodegaId)

    const { data, error } = await q
    if (error) throw error

    const map: Record<string, { nombre: string; ingreso: number; costoBase: number }> = {}

        ; (data || []).forEach((p: any) => {
            ; (p.detalle_pedido || []).forEach((d: any) => {
                const id = d.producto_id
                const nombre = d.productos?.nombre || 'Producto'
                const cant = Number(d.cantidad_aprobada || 0)

                // Ingreso: Lo que se cobró en el pedido
                const ingreso = cant * Number(d.precio_unitario || 0)

                // Costo base: Usamos el precio mayorista (o el precio normal si no existe)
                const costoUnitario = d.productos?.precio_mayorista ?? d.productos?.precio ?? 0
                const costoBase = cant * Number(costoUnitario)

                if (!map[id]) map[id] = { nombre, ingreso: 0, costoBase: 0 }
                map[id].ingreso += ingreso
                map[id].costoBase += costoBase
            })
        })

    return Object.values(map).map(p => {
        const margen = p.ingreso - p.costoBase
        const pct = p.ingreso > 0 ? (margen / p.ingreso) * 100 : 0
        return { ...p, margen, pct }
    }).sort((a, b) => b.margen - a.margen)
}

// 2. Utilidad total (general)
export async function utilidadMes(sb: SupabaseClient, f: FiltrosStats) {
    const todos = await margenPorProducto(sb, f)

    const ingresoTotal = todos.reduce((s, p) => s + p.ingreso, 0)
    const costoTotal = todos.reduce((s, p) => s + p.costoBase, 0)
    const utilidad = ingresoTotal - costoTotal
    const margenPct = ingresoTotal > 0 ? (utilidad / ingresoTotal) * 100 : 0

    return { ingresoTotal, costoTotal, utilidad, margenPct }
}