'use client'
import { SupabaseClient } from '@supabase/supabase-js'
import { FiltrosStats, ESTADOS_VENTA, ESTADOS_PERDIDA } from './types'
import { calcularRangos, iso } from './fechas'

const fmtMoney = (n: number) =>
    new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n || 0)

const fmtPct = (n: number) => `${(n || 0).toFixed(1)}%`

// 1. Ventas por mes y año
export async function ventasPorMes(
    sb: SupabaseClient,
    f: FiltrosStats
): Promise<{ periodo: string; total: number }[]> {
    const { actual } = calcularRangos(f)
    let q = sb
        .from('pedidos')
        .select('fecha, total')
        .in('estado', ESTADOS_VENTA as unknown as string[])
        .gte('fecha', iso(actual.desde))
        .lte('fecha', iso(actual.hasta))
    if (f.bodegaId) q = q.eq('bodega_id', f.bodegaId)

    const { data, error } = await q
    if (error) throw error

    const map: Record<string, number> = {}
        ; (data || []).forEach((p: any) => {
            const d = new Date(p.fecha)
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
            map[key] = (map[key] || 0) + Number(p.total || 0)
        })
    return Object.entries(map)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([periodo, total]) => ({ periodo, total }))
}

// 2. Comparación mes vs mes / año vs año
export async function comparacionPeriodos(sb: SupabaseClient, f: FiltrosStats) {
    const { actual, anterior } = calcularRangos(f)

    const fetch = async (desde: Date, hasta: Date) => {
        let q = sb
            .from('pedidos')
            .select('total')
            .in('estado', ESTADOS_VENTA as unknown as string[])
            .gte('fecha', iso(desde))
            .lte('fecha', iso(hasta))
        if (f.bodegaId) q = q.eq('bodega_id', f.bodegaId)
        const { data, error } = await q
        if (error) throw error
        return (data || []).reduce((s: number, p: any) => s + Number(p.total || 0), 0)
    }

    const [act, ant] = await Promise.all([fetch(actual.desde, actual.hasta), fetch(anterior.desde, anterior.hasta)])
    const variacion = ant > 0 ? ((act - ant) / ant) * 100 : 0

    return { actual: act, anterior: ant, variacion }
}

// 3. Ventas por bodega
export async function ventasPorBodega(sb: SupabaseClient, f: FiltrosStats) {
    const { actual } = calcularRangos(f)
    let q = sb
        .from('pedidos')
        .select('bodega_id, total, bodegas(nombre)')
        .in('estado', ESTADOS_VENTA as unknown as string[])
        .gte('fecha', iso(actual.desde))
        .lte('fecha', iso(actual.hasta))
    if (f.bodegaId) q = q.eq('bodega_id', f.bodegaId)

    const { data, error } = await q
    if (error) throw error

    const map: Record<string, { bodega: string; total: number }> = {}
        ; (data || []).forEach((p: any) => {
            const id = p.bodega_id || 'sin'
            const nombre = p.bodegas?.nombre || 'Sin bodega'
            if (!map[id]) map[id] = { bodega: nombre, total: 0 }
            map[id].total += Number(p.total || 0)
        })
    return Object.values(map).sort((a, b) => b.total - a.total)
}

// 4. Descuentos otorgados
export async function descuentosOtorgados(sb: SupabaseClient, f: FiltrosStats) {
    const { actual } = calcularRangos(f)
    let q = sb
        .from('pedidos')
        .select('subtotal, descuento_valor')
        .in('estado', ESTADOS_VENTA as unknown as string[])
        .gte('fecha', iso(actual.desde))
        .lte('fecha', iso(actual.hasta))
    if (f.bodegaId) q = q.eq('bodega_id', f.bodegaId)

    const { data, error } = await q
    if (error) throw error

    const subtotal = (data || []).reduce((s: number, p: any) => s + Number(p.subtotal || 0), 0)
    const descuento = (data || []).reduce((s: number, p: any) => s + Number(p.descuento_valor || 0), 0)
    const pct = subtotal > 0 ? (descuento / subtotal) * 100 : 0
    return { descuento, subtotal, pct }
}

// 5. Entregados vs cancelados
export async function entregadosVsCancelados(sb: SupabaseClient, f: FiltrosStats) {
    const { actual } = calcularRangos(f)
    let q = sb
        .from('pedidos')
        .select('estado')
        .gte('fecha', iso(actual.desde))
        .lte('fecha', iso(actual.hasta))
    if (f.bodegaId) q = q.eq('bodega_id', f.bodegaId)

    const { data, error } = await q
    if (error) throw error

    const map: Record<string, number> = {}
        ; (data || []).forEach((p: any) => {
            map[p.estado] = (map[p.estado] || 0) + 1
        })
    const total = data?.length || 0
    const entregados = map['entregado'] || 0
    const cancelados =
        ESTADOS_PERDIDA.reduce((s, e) => s + (map[e] || 0), 0)
    return { total, entregados, cancelados, detalle: map }
}

export { fmtMoney, fmtPct }