'use client'
import { SupabaseClient } from '@supabase/supabase-js'
import { FiltrosStats, ESTADOS_VENTA } from './types'
import { calcularRangos, iso } from './fechas'

// 1. Productos más vendidos
export async function productosMasVendidos(sb: SupabaseClient, f: FiltrosStats) {
    const { actual } = calcularRangos(f)

    let q = sb
        .from('pedidos')
        .select('id, bodega_id, detalle_pedido(producto_id, cantidad_aprobada, productos(nombre))')
        .in('estado', ESTADOS_VENTA as unknown as string[])
        .gte('fecha', iso(actual.desde))
        .lte('fecha', iso(actual.hasta))
    if (f.bodegaId) q = q.eq('bodega_id', f.bodegaId)

    const { data, error } = await q
    if (error) throw error

    const map: Record<string, { nombre: string; cantidad: number }> = {}
        ; (data || []).forEach((p: any) => {
            ; (p.detalle_pedido || []).forEach((d: any) => {
                const id = d.producto_id
                const nombre = d.productos?.nombre || 'Producto'
                if (!map[id]) map[id] = { nombre, cantidad: 0 }
                map[id].cantidad += Number(d.cantidad_aprobada || 0)
            })
        })
    return Object.values(map).sort((a, b) => b.cantidad - a.cantidad).slice(0, 15)
}

// 2. Categorías más vendidas
export async function categoriasMasVendidas(sb: SupabaseClient, f: FiltrosStats) {
    const { actual } = calcularRangos(f)
    let q = sb
        .from('pedidos')
        .select('bodega_id, detalle_pedido(cantidad_aprobada, productos(categoria))')
        .in('estado', ESTADOS_VENTA as unknown as string[])
        .gte('fecha', iso(actual.desde))
        .lte('fecha', iso(actual.hasta))
    if (f.bodegaId) q = q.eq('bodega_id', f.bodegaId)

    const { data, error } = await q
    if (error) throw error

    const map: Record<string, number> = {}
        ; (data || []).forEach((p: any) => {
            ; (p.detalle_pedido || []).forEach((d: any) => {
                const cat = d.productos?.categoria || 'OTROS'
                map[cat] = (map[cat] || 0) + Number(d.cantidad_aprobada || 0)
            })
        })
    const total = Object.values(map).reduce((s, v) => s + v, 0)
    return Object.entries(map)
        .map(([categoria, cantidad]) => ({ categoria, cantidad, pct: total > 0 ? (cantidad / total) * 100 : 0 }))
        .sort((a, b) => b.cantidad - a.cantidad)
}

// 3. Clasificación ABC (por ingresos)
export async function clasificacionABC(sb: SupabaseClient, f: FiltrosStats) {
    const { actual } = calcularRangos(f)
    let q = sb
        .from('pedidos')
        .select('bodega_id, detalle_pedido(cantidad_aprobada, precio_unitario, producto_id, productos(nombre))')
        .in('estado', ESTADOS_VENTA as unknown as string[])
        .gte('fecha', iso(actual.desde))
        .lte('fecha', iso(actual.hasta))
    if (f.bodegaId) q = q.eq('bodega_id', f.bodegaId)

    const { data, error } = await q
    if (error) throw error

    const map: Record<string, { nombre: string; ingreso: number }> = {}
        ; (data || []).forEach((p: any) => {
            ; (p.detalle_pedido || []).forEach((d: any) => {
                const id = d.producto_id
                const nombre = d.productos?.nombre || 'Producto'
                const ingreso = Number(d.cantidad_aprobada || 0) * Number(d.precio_unitario || 0)
                if (!map[id]) map[id] = { nombre, ingreso: 0 }
                map[id].ingreso += ingreso
            })
        })

    const ordenado = Object.values(map).sort((a, b) => b.ingreso - a.ingreso)
    const total = ordenado.reduce((s, v) => s + v.ingreso, 0)

    let acum = 0
    const clasificados = ordenado.map((p) => {
        acum += p.ingreso
        const pctAcum = total > 0 ? (acum / total) * 100 : 0
        const clase = pctAcum <= 80 ? 'A' : pctAcum <= 95 ? 'B' : 'C'
        return { ...p, pctAcum, clase }
    })

    const resumen = { A: 0, B: 0, C: 0 } as Record<string, number>
    clasificados.forEach((p) => (resumen[p.clase] += 1))

    return { clasificados, resumen, total }
}

// 4. Productos sin rotación (90 días)
export async function productosSinRotacion(sb: SupabaseClient, f: FiltrosStats) {
    const bodegaId = f.bodegaId
    const hace90 = new Date()
    hace90.setDate(hace90.getDate() - 90)
    const desdeISO = iso(hace90)

    // traer productos con stock
    let invQ = sb.from('inventario').select('producto_id, cantidad_disponible, bodega_id, productos(nombre, categoria)')
    if (bodegaId) invQ = invQ.eq('bodega_id', bodegaId)
    const { data: inv, error: errInv } = await invQ
    if (errInv) throw errInv

    // productos con movimientos o ventas en 90d
    let movQ = sb.from('movimientos').select('producto_id').gte('fecha', desdeISO)
    if (bodegaId) movQ = movQ.eq('bodega_id', bodegaId)
    const { data: movs } = await movQ

    let ventasQ = sb
        .from('pedidos')
        .select('bodega_id, detalle_pedido(producto_id)')
        .in('estado', ESTADOS_VENTA as unknown as string[])
        .gte('fecha', desdeISO)
    if (bodegaId) ventasQ = ventasQ.eq('bodega_id', bodegaId)
    const { data: ventas } = await ventasQ

    const conMov = new Set<string>()
        ; (movs || []).forEach((m: any) => m.producto_id && conMov.add(m.producto_id))
        ; (ventas || []).forEach((p: any) => (p.detalle_pedido || []).forEach((d: any) => d.producto_id && conMov.add(d.producto_id)))

    return (inv || [])
        .filter((i: any) => (i.cantidad_disponible || 0) > 0 && !conMov.has(i.producto_id))
        .map((i: any) => ({
            producto_id: i.producto_id,
            nombre: i.productos?.nombre || 'Producto',
            categoria: i.productos?.categoria || 'OTROS',
            stock: i.cantidad_disponible,
        }))
        .slice(0, 30)
}

// 5. Sobrestock (>10x mínimo)
export async function sobrestock(sb: SupabaseClient, f: FiltrosStats) {
    let q = sb
        .from('inventario')
        .select('producto_id, cantidad_disponible, cantidad_minima, bodega_id, productos(nombre, categoria)')
        .gt('cantidad_disponible', 0)
    if (f.bodegaId) q = q.eq('bodega_id', f.bodegaId)
    const { data, error } = await q
    if (error) throw error

    return (data || [])
        .filter((i: any) => i.cantidad_minima > 0 && i.cantidad_disponible > i.cantidad_minima * 10)
        .map((i: any) => ({
            nombre: i.productos?.nombre || 'Producto',
            stock: i.cantidad_disponible,
            minimo: i.cantidad_minima,
            exceso: i.cantidad_disponible - i.cantidad_minima * 10,
        }))
        .sort((a, b) => b.exceso - a.exceso)
        .slice(0, 20)
}

// 6. Agotados con demanda (0 stock + ventas últimas 4 semanas)
export async function agotadosConDemanda(sb: SupabaseClient, f: FiltrosStats) {
    const hace28 = new Date()
    hace28.setDate(hace28.getDate() - 28)

    let invQ = sb.from('inventario').select('producto_id, cantidad_disponible, bodega_id, productos(nombre)')
    if (f.bodegaId) invQ = invQ.eq('bodega_id', f.bodegaId)
    const { data: inv } = await invQ

    const agotados = new Set<string>()
        ; (inv || []).forEach((i: any) => {
            if ((i.cantidad_disponible || 0) <= 0) agotados.add(i.producto_id)
        })

    let ventasQ = sb
        .from('pedidos')
        .select('bodega_id, detalle_pedido(producto_id, cantidad_aprobada, productos(nombre))')
        .in('estado', ESTADOS_VENTA as unknown as string[])
        .gte('fecha', iso(hace28))
    if (f.bodegaId) ventasQ = ventasQ.eq('bodega_id', f.bodegaId)
    const { data: ventas } = await ventasQ

    const demand: Record<string, { nombre: string; cantidad: number }> = {}
        ; (ventas || []).forEach((p: any) => {
            ; (p.detalle_pedido || []).forEach((d: any) => {
                if (!agotados.has(d.producto_id)) return
                const id = d.producto_id
                if (!demand[id]) demand[id] = { nombre: d.productos?.nombre || 'Producto', cantidad: 0 }
                demand[id].cantidad += Number(d.cantidad_aprobada || 0)
            })
        })
    return Object.entries(demand)
        .map(([producto_id, v]) => ({ producto_id, ...v }))
        .sort((a, b) => b.cantidad - a.cantidad)
        .slice(0, 20)
}

// 7. Nivel de servicio
export async function nivelServicio(sb: SupabaseClient, f: FiltrosStats) {
    const { actual } = calcularRangos(f)
    let q = sb
        .from('pedidos')
        .select('bodega_id, detalle_pedido(cantidad_solicitada, cantidad_aprobada)')
        .in('estado', ESTADOS_VENTA as unknown as string[])
        .gte('fecha', iso(actual.desde))
        .lte('fecha', iso(actual.hasta))
    if (f.bodegaId) q = q.eq('bodega_id', f.bodegaId)

    const { data, error } = await q
    if (error) throw error

    let solic = 0, aprob = 0
        ; (data || []).forEach((p: any) => {
            ; (p.detalle_pedido || []).forEach((d: any) => {
                solic += Number(d.cantidad_solicitada || 0)
                aprob += Number(d.cantidad_aprobada || 0)
            })
        })
    return { solicitado: solic, aprobado: aprob, pct: solic > 0 ? (aprob / solic) * 100 : 0 }
}

// 8. Valor del inventario (a precio de venta)
export async function valorInventario(sb: SupabaseClient, f: FiltrosStats) {
    let q = sb
        .from('inventario')
        .select('cantidad_disponible, bodega_id, productos(precio)')
    if (f.bodegaId) q = q.eq('bodega_id', f.bodegaId)
    const { data, error } = await q
    if (error) throw error

    let valor = 0, unidades = 0
        ; (data || []).forEach((i: any) => {
            unidades += i.cantidad_disponible || 0
            valor += (i.cantidad_disponible || 0) * Number(i.productos?.precio || 0)
        })
    return { valor, unidades }
}