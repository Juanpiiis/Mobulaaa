'use client'
import { SupabaseClient } from '@supabase/supabase-js'
import { FiltrosStats, ESTADOS_VENTA } from './types'
import { calcularRangos, iso } from './fechas'

// 1. Ranking vendedores
export async function rankingVendedores(sb: SupabaseClient, f: FiltrosStats) {
    const { actual } = calcularRangos(f)
    let q = sb
        .from('pedidos')
        .select('vendedor_id, total, usuarios(nombre)')
        .in('estado', ESTADOS_VENTA as unknown as string[])
        .gte('fecha', iso(actual.desde))
        .lte('fecha', iso(actual.hasta))
    if (f.bodegaId) q = q.eq('bodega_id', f.bodegaId)

    const { data, error } = await q
    if (error) throw error

    const map: Record<string, { nombre: string; pedidos: number; total: number }> = {}
        ; (data || []).forEach((p: any) => {
            const id = p.vendedor_id || 'sin'
            const nombre = p.usuarios?.nombre || 'Sin asignar'
            if (!map[id]) map[id] = { nombre, pedidos: 0, total: 0 }
            map[id].pedidos += 1
            map[id].total += Number(p.total || 0)
        })
    return Object.values(map).sort((a, b) => b.total - a.total)
}

// 2. Ticket promedio por vendedor
export async function ticketPromedioVendedor(sb: SupabaseClient, f: FiltrosStats) {
    const ranking = await rankingVendedores(sb, f)
    return ranking.map((r) => ({ ...r, ticket: r.pedidos > 0 ? r.total / r.pedidos : 0 }))
}

// 3. Rechazos y devoluciones por vendedor
export async function rechazosPorVendedor(sb: SupabaseClient, f: FiltrosStats) {
    const { actual } = calcularRangos(f)
    let q = sb
        .from('pedidos')
        .select('vendedor_id, estado, usuarios(nombre)')
        .gte('fecha', iso(actual.desde))
        .lte('fecha', iso(actual.hasta))
    if (f.bodegaId) q = q.eq('bodega_id', f.bodegaId)

    const { data, error } = await q
    if (error) throw error

    const map: Record<string, { nombre: string; total: number; rechazados: number; devueltos: number }> = {}
        ; (data || []).forEach((p: any) => {
            const id = p.vendedor_id || 'sin'
            const nombre = p.usuarios?.nombre || 'Sin asignar'
            if (!map[id]) map[id] = { nombre, total: 0, rechazados: 0, devueltos: 0 }
            map[id].total += 1
            if (p.estado === 'rechazado_cartera' || p.estado === 'rechazado_bodega') map[id].rechazados += 1
            if (p.estado === 'devuelto_por_cartera') map[id].devueltos += 1
        })
    return Object.values(map)
        .map((v) => ({ ...v, pct: v.total > 0 ? ((v.rechazados + v.devueltos) / v.total) * 100 : 0 }))
        .sort((a, b) => b.pct - a.pct)
}

// 4. Descuento promedio por vendedor
export async function descuentoPromedioVendedor(sb: SupabaseClient, f: FiltrosStats) {
    const { actual } = calcularRangos(f)
    let q = sb
        .from('pedidos')
        .select('vendedor_id, descuento_porcentaje, usuarios(nombre)')
        .in('estado', ESTADOS_VENTA as unknown as string[])
        .gte('fecha', iso(actual.desde))
        .lte('fecha', iso(actual.hasta))
    if (f.bodegaId) q = q.eq('bodega_id', f.bodegaId)

    const { data, error } = await q
    if (error) throw error

    const map: Record<string, { nombre: string; suma: number; count: number }> = {}
        ; (data || []).forEach((p: any) => {
            const id = p.vendedor_id || 'sin'
            const nombre = p.usuarios?.nombre || 'Sin asignar'
            if (!map[id]) map[id] = { nombre, suma: 0, count: 0 }
            map[id].suma += Number(p.descuento_porcentaje || 0)
            map[id].count += 1
        })
    return Object.values(map)
        .map((v) => ({ nombre: v.nombre, promedio: v.count > 0 ? v.suma / v.count : 0 }))
        .sort((a, b) => b.promedio - a.promedio)
}