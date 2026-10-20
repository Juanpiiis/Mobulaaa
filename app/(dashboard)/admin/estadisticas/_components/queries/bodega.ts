'use client'
import { SupabaseClient } from '@supabase/supabase-js'
import { FiltrosStats } from './types'
import { calcularRangos, iso } from './fechas'

// 1. Movimientos por tipo
export async function movimientosPorTipo(sb: SupabaseClient, f: FiltrosStats) {
    const { actual } = calcularRangos(f)
    let q = sb
        .from('movimientos')
        .select('tipo, cantidad')
        .gte('fecha', iso(actual.desde))
        .lte('fecha', iso(actual.hasta))
    if (f.bodegaId) q = q.eq('bodega_id', f.bodegaId)

    const { data, error } = await q
    if (error) throw error

    const map: Record<string, number> = {}
        ; (data || []).forEach((m: any) => {
            const t = m.tipo || 'otro'
            map[t] = (map[t] || 0) + Number(m.cantidad || 0)
        })
    return Object.entries(map).map(([tipo, cantidad]) => ({ tipo, cantidad }))
}

// 2. Rotación de inventario (unidades)
export async function rotacionInventario(sb: SupabaseClient, f: FiltrosStats) {
    const { actual } = calcularRangos(f)

    let invQ = sb.from('inventario').select('cantidad_disponible')
    if (f.bodegaId) invQ = invQ.eq('bodega_id', f.bodegaId)
    const { data: inv } = await invQ
    const invActual = (inv || []).reduce((s: number, i: any) => s + (i.cantidad_disponible || 0), 0)

    let salQ = sb
        .from('movimientos')
        .select('cantidad')
        .eq('tipo', 'salida')
        .gte('fecha', iso(actual.desde))
        .lte('fecha', iso(actual.hasta))
    if (f.bodegaId) salQ = salQ.eq('bodega_id', f.bodegaId)
    const { data: sal } = await salQ
    const salidas = (sal || []).reduce((s: number, m: any) => s + (m.cantidad || 0), 0)

    const rotacion = invActual > 0 ? salidas / invActual : 0
    return { salidas, invActual, rotacion }
}

// 3. Stock bajo y agotados
export async function stockBajoAgotados(sb: SupabaseClient, f: FiltrosStats) {
    let q = sb.from('inventario').select('cantidad_disponible, cantidad_minima, productos(nombre, categoria)')
    if (f.bodegaId) q = q.eq('bodega_id', f.bodegaId)
    const { data, error } = await q
    if (error) throw error

    const bajo: any[] = []
    const agotados: any[] = []
        ; (data || []).forEach((i: any) => {
            if ((i.cantidad_disponible || 0) <= 0) agotados.push(i)
            else if (i.cantidad_minima && i.cantidad_disponible < i.cantidad_minima) bajo.push(i)
        })
    return { bajo: bajo.length, agotados: agotados.length, detalleBajo: bajo.slice(0, 15), detalleAgotados: agotados.slice(0, 15) }
}

// 4. Actividad por usuario
export async function actividadPorUsuario(sb: SupabaseClient, f: FiltrosStats) {
    const { actual } = calcularRangos(f)
    let q = sb
        .from('movimientos')
        .select('usuario_id, usuarios(nombre)')
        .gte('fecha', iso(actual.desde))
        .lte('fecha', iso(actual.hasta))
    if (f.bodegaId) q = q.eq('bodega_id', f.bodegaId)

    const { data, error } = await q
    if (error) throw error

    const map: Record<string, { nombre: string; count: number }> = {}
        ; (data || []).forEach((m: any) => {
            const id = m.usuario_id || 'sin'
            const nombre = m.usuarios?.nombre || 'Sin usuario'
            if (!map[id]) map[id] = { nombre, count: 0 }
            map[id].count += 1
        })
    return Object.values(map).sort((a, b) => b.count - a.count)
}

// 5. Productos con más diferencias (cortes)
export async function productosConDiferencias(sb: SupabaseClient, f: FiltrosStats) {
    const { actual } = calcularRangos(f)
    let q = sb
        .from('cortes_detalle')
        .select('producto_id, diferencia, referencia_excel, cortes!inner(fecha, bodega_id)')
        .neq('diferencia', 0)
        .gte('cortes.fecha', iso(actual.desde))
        .lte('cortes.fecha', iso(actual.hasta))
    if (f.bodegaId) q = q.eq('cortes.bodega_id', f.bodegaId)

    const { data, error } = await q
    if (error) throw error

    const map: Record<string, { ref: string; count: number; difTotal: number }> = {}
        ; (data || []).forEach((d: any) => {
            const key = d.producto_id || d.referencia_excel
            if (!map[key]) map[key] = { ref: d.referencia_excel, count: 0, difTotal: 0 }
            map[key].count += 1
            map[key].difTotal += Math.abs(d.diferencia || 0)
        })
    return Object.values(map).sort((a, b) => b.count - a.count).slice(0, 20)
}

// 6. Ajustes por motivo
export async function ajustesPorMotivo(sb: SupabaseClient, f: FiltrosStats) {
    const { actual } = calcularRangos(f)
    let q = sb
        .from('ajustes_inventario')
        .select('motivo, cantidad_antes, cantidad_despues')
        .gte('fecha', iso(actual.desde))
        .lte('fecha', iso(actual.hasta))
    if (f.bodegaId) q = q.eq('bodega_id', f.bodegaId)

    const { data, error } = await q
    if (error) throw error

    const map: Record<string, { count: number; delta: number }> = {}
        ; (data || []).forEach((a: any) => {
            const m = a.motivo || 'otro'
            if (!map[m]) map[m] = { count: 0, delta: 0 }
            map[m].count += 1
            map[m].delta += (a.cantidad_despues || 0) - (a.cantidad_antes || 0)
        })
    return Object.entries(map).map(([motivo, v]) => ({ motivo, ...v }))
}