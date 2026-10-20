'use client'
import { SupabaseClient } from '@supabase/supabase-js'
import { FiltrosStats } from './types'
import { calcularRangos, iso } from './fechas'

// 1. Tiempo promedio de aprobación (creación → aprobado_cartera)
export async function tiempoAprobacion(sb: SupabaseClient, f: FiltrosStats) {
    const { actual } = calcularRangos(f)
    let q = sb
        .from('pedidos')
        .select('fecha, aprobado_cartera_en')
        .not('aprobado_cartera_en', 'is', null)
        .gte('fecha', iso(actual.desde))
        .lte('fecha', iso(actual.hasta))
    if (f.bodegaId) q = q.eq('bodega_id', f.bodegaId)

    const { data, error } = await q
    if (error) throw error

    const horas = (data || []).map((p: any) => {
        const a = new Date(p.fecha).getTime()
        const b = new Date(p.aprobado_cartera_en).getTime()
        return (b - a) / (1000 * 60 * 60)
    })
    const prom = horas.length > 0 ? horas.reduce((s, v) => s + v, 0) / horas.length : 0
    return { promedioHoras: prom, muestras: horas.length }
}

// 2. Tiempo hasta despacho y entrega (usa pedidos_historial)
export async function tiempoDespachoEntrega(sb: SupabaseClient, f: FiltrosStats) {
    const { actual } = calcularRangos(f)
    let q = sb
        .from('pedidos_historial')
        .select('pedido_id, accion, fecha')
        .in('accion', ['aprobado_cartera', 'despachado', 'entregado'])
        .gte('fecha', iso(actual.desde))
        .lte('fecha', iso(actual.hasta))

    const { data, error } = await q
    if (error) throw error

    const porPedido: Record<string, Record<string, string>> = {}
        ; (data || []).forEach((h: any) => {
            if (!porPedido[h.pedido_id]) porPedido[h.pedido_id] = {}
            porPedido[h.pedido_id][h.accion] = h.fecha
        })

    const difsDespacho: number[] = []
    const difsEntrega: number[] = []
    Object.values(porPedido).forEach((h) => {
        if (h.aprobado_cartera && h.despachado) {
            difsDespacho.push((new Date(h.despachado).getTime() - new Date(h.aprobado_cartera).getTime()) / (1000 * 60 * 60 * 24))
        }
        if (h.despachado && h.entregado) {
            difsEntrega.push((new Date(h.entregado).getTime() - new Date(h.despachado).getTime()) / (1000 * 60 * 60 * 24))
        }
    })

    return {
        aprobacionDespacho: difsDespacho.length > 0 ? difsDespacho.reduce((s, v) => s + v, 0) / difsDespacho.length : 0,
        despachoEntrega: difsEntrega.length > 0 ? difsEntrega.reduce((s, v) => s + v, 0) / difsEntrega.length : 0,
        muestras: { despacho: difsDespacho.length, entrega: difsEntrega.length },
    }
}

// 3. Pendientes más antiguos
export async function pendientesAntiguos(sb: SupabaseClient, f: FiltrosStats) {
    let q = sb
        .from('pedidos')
        .select('id, estado, fecha, total, clientes(nombre), usuarios(nombre)')
        .in('estado', ['pendiente', 'aprobado_cartera', 'en_preparacion', 'listo_para_despacho'])
    if (f.bodegaId) q = q.eq('bodega_id', f.bodegaId)
    q = q.order('fecha', { ascending: true }).limit(20)

    const { data, error } = await q
    if (error) throw error

    const ahora = Date.now()
    return (data || []).map((p: any) => ({
        id: p.id,
        estado: p.estado,
        dias: Math.floor((ahora - new Date(p.fecha).getTime()) / (1000 * 60 * 60 * 24)),
        total: Number(p.total || 0),
        cliente: p.clientes?.nombre || '—',
        vendedor: p.usuarios?.nombre || '—',
    }))
}