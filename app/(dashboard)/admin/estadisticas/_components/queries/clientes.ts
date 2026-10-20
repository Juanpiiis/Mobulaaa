'use client'
import { SupabaseClient } from '@supabase/supabase-js'
import { FiltrosStats, ESTADOS_VENTA } from './types'
import { calcularRangos, iso } from './fechas'

// 1. Clientes más activos
export async function clientesMasActivos(sb: SupabaseClient, f: FiltrosStats) {
    const { actual } = calcularRangos(f)
    let q = sb
        .from('pedidos')
        .select('cliente_id, total, clientes(nombre, cc_nit)')
        .in('estado', ESTADOS_VENTA as unknown as string[])
        .gte('fecha', iso(actual.desde))
        .lte('fecha', iso(actual.hasta))
    if (f.bodegaId) q = q.eq('bodega_id', f.bodegaId)

    const { data, error } = await q
    if (error) throw error

    const map: Record<string, { nombre: string; nit: string; pedidos: number; total: number }> = {}
        ; (data || []).forEach((p: any) => {
            const id = p.cliente_id || 'sin'
            const nombre = p.clientes?.nombre || 'Sin cliente'
            const nit = p.clientes?.cc_nit || ''
            if (!map[id]) map[id] = { nombre, nit, pedidos: 0, total: 0 }
            map[id].pedidos += 1
            map[id].total += Number(p.total || 0)
        })
    return Object.values(map).sort((a, b) => b.total - a.total).slice(0, 15)
}

// 2. Clientes inactivos (+60 días)
export async function clientesInactivos(sb: SupabaseClient, f: FiltrosStats) {
    const hace60 = new Date()
    hace60.setDate(hace60.getDate() - 60)

    let pedQ = sb
        .from('pedidos')
        .select('cliente_id')
        .in('estado', ESTADOS_VENTA as unknown as string[])
        .gte('fecha', iso(hace60))
    if (f.bodegaId) pedQ = pedQ.eq('bodega_id', f.bodegaId)
    const { data: recientes } = await pedQ

    const activos = new Set<string>()
        ; (recientes || []).forEach((p: any) => p.cliente_id && activos.add(p.cliente_id))

    const { data: todos } = await sb.from('clientes').select('id, nombre, cc_nit').eq('activo', true)

    return (todos || [])
        .filter((c: any) => !activos.has(c.id))
        .map((c: any) => ({ id: c.id, nombre: c.nombre, nit: c.cc_nit }))
        .slice(0, 50)
}

// 3. Concentración de ventas (top 5)
export async function concentracionVentas(sb: SupabaseClient, f: FiltrosStats) {
    const ranking = await clientesMasActivos(sb, f)
    const top5 = ranking.slice(0, 5)
    const total = ranking.reduce((s, c) => s + c.total, 0)
    const top5Total = top5.reduce((s, c) => s + c.total, 0)
    return { top5, total, top5Total, pct: total > 0 ? (top5Total / total) * 100 : 0 }
}