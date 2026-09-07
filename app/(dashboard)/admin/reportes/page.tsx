'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useTienda } from '@/lib/context/TiendaContext'

interface ReporteMovimiento {
  tipo: string
  total: number
  cantidad_movimientos: number
}

interface ProductoTop {
  nombre: string
  categoria: string
  total_pedido: number
}

interface VendedorTop {
  nombre: string
  total_pedidos: number
  total_valor: number
}

export default function ReportesPage() {
  const [movimientos, setMovimientos] = useState<ReporteMovimiento[]>([])
  const [productosTop, setProductosTop] = useState<ProductoTop[]>([])
  const [vendedoresTop, setVendedoresTop] = useState<VendedorTop[]>([])
  const [totalFacturado, setTotalFacturado] = useState(0)
  const [loading, setLoading] = useState(true)
  const [fechaDesde, setFechaDesde] = useState(() => {
    const d = new Date()
    d.setMonth(d.getMonth() - 1)
    return d.toISOString().split('T')[0]
  })
  const [fechaHasta, setFechaHasta] = useState(() => new Date().toISOString().split('T')[0])
  const { tiendaActual } = useTienda()
  const supabase = createClient()

  const fetchReports = async () => {
    if (!tiendaActual) return
    setLoading(true)

    // Movimientos por tipo
    const { data: movs } = await supabase
      .from('movimientos')
      .select('tipo, cantidad')
      .or(`bodega_origen_id.eq.${tiendaActual.id},bodega_destino_id.eq.${tiendaActual.id}`)
      .gte('fecha', fechaDesde)
      .lte('fecha', fechaHasta + 'T23:59:59')

    const resumenMovs: Record<string, ReporteMovimiento> = {}
    movs?.forEach(m => {
      if (!resumenMovs[m.tipo]) resumenMovs[m.tipo] = { tipo: m.tipo, total: 0, cantidad_movimientos: 0 }
      resumenMovs[m.tipo].total += m.cantidad
      resumenMovs[m.tipo].cantidad_movimientos++
    })
    setMovimientos(Object.values(resumenMovs))

    // Productos más pedidos
    const { data: detalles } = await supabase
      .from('detalle_pedido')
      .select('cantidad_solicitada, productos(nombre, categoria), pedidos!inner(bodega_id, estado, fecha)')
      .eq('pedidos.bodega_id', tiendaActual.id)
      .neq('pedidos.estado', 'rechazado_bodega')
      .neq('pedidos.estado', 'rechazado_cartera')
      .gte('pedidos.fecha', fechaDesde)
      .lte('pedidos.fecha', fechaHasta + 'T23:59:59')

    const resumenProductos: Record<string, ProductoTop> = {}
    detalles?.forEach((d: any) => {
      const nombre = d.productos?.nombre
      if (!nombre) return
      if (!resumenProductos[nombre]) resumenProductos[nombre] = { nombre, categoria: d.productos?.categoria, total_pedido: 0 }
      resumenProductos[nombre].total_pedido += d.cantidad_solicitada
    })
    setProductosTop(Object.values(resumenProductos).sort((a, b) => b.total_pedido - a.total_pedido).slice(0, 10))

    // Vendedores top
    const { data: pedidos } = await supabase
      .from('pedidos')
      .select('total, usuarios(nombre)')
      .eq('bodega_id', tiendaActual.id)
      .eq('estado', 'aprobado_cartera')
      .gte('fecha', fechaDesde)
      .lte('fecha', fechaHasta + 'T23:59:59')

    const resumenVendedores: Record<string, VendedorTop> = {}
    let facturado = 0
    pedidos?.forEach((p: any) => {
      const nombre = p.usuarios?.nombre
      if (!nombre) return
      if (!resumenVendedores[nombre]) resumenVendedores[nombre] = { nombre, total_pedidos: 0, total_valor: 0 }
      resumenVendedores[nombre].total_pedidos++
      resumenVendedores[nombre].total_valor += p.total || 0
      facturado += p.total || 0
    })
    setVendedoresTop(Object.values(resumenVendedores).sort((a, b) => b.total_valor - a.total_valor))
    setTotalFacturado(facturado)
    setLoading(false)
  }

  useEffect(() => { fetchReports() }, [tiendaActual, fechaDesde, fechaHasta])

  const formatCOP = (value: number) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(value)

  const tipoColor: Record<string, string> = {
    entrada: 'bg-green-100 text-green-700',
    salida: 'bg-red-100 text-red-700',
    traslado: 'bg-blue-100 text-blue-700'
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Reportes</h1>
        <p className="text-gray-500 text-sm">{tiendaActual?.nombre}</p>
      </div>

      {/* Filtros fecha */}
      <div className="bg-white rounded-lg shadow p-4 mb-6 flex gap-4 items-end">
        <div>
          <label className="block text-sm font-medium mb-1">Desde</label>
          <input type="date" className="border p-2 rounded" value={fechaDesde} onChange={e => setFechaDesde(e.target.value)} />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Hasta</label>
          <input type="date" className="border p-2 rounded" value={fechaHasta} onChange={e => setFechaHasta(e.target.value)} />
        </div>
        <button onClick={fetchReports} className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">Actualizar</button>
      </div>

      {loading ? <p>Cargando...</p> : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Total facturado */}
          <div className="lg:col-span-2 bg-blue-600 text-white rounded-lg shadow p-6">
            <p className="text-blue-200 text-sm mb-1">Total facturado en el período</p>
            <p className="text-4xl font-bold">{formatCOP(totalFacturado)}</p>
          </div>

          {/* Movimientos por tipo */}
          <div className="bg-white rounded-lg shadow p-4">
            <h2 className="font-bold text-lg mb-4">Movimientos por tipo</h2>
            {movimientos.length === 0 ? <p className="text-gray-400 text-sm">Sin movimientos en el período</p> : (
              <div className="flex flex-col gap-3">
                {movimientos.map(m => (
                  <div key={m.tipo} className="flex justify-between items-center">
                    <span className={`px-3 py-1 rounded text-sm capitalize ${tipoColor[m.tipo]}`}>{m.tipo}</span>
                    <div className="text-right">
                      <p className="font-bold">{m.total} unidades</p>
                      <p className="text-xs text-gray-400">{m.cantidad_movimientos} movimientos</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Vendedores top */}
          <div className="bg-white rounded-lg shadow p-4">
            <h2 className="font-bold text-lg mb-4">Vendedores por valor</h2>
            {vendedoresTop.length === 0 ? <p className="text-gray-400 text-sm">Sin pedidos aprobados en el período</p> : (
              <div className="flex flex-col gap-3">
                {vendedoresTop.map((v, i) => (
                  <div key={v.nombre} className="flex justify-between items-center border-b pb-2">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xs font-bold">{i + 1}</span>
                      <span className="text-sm font-medium">{v.nombre}</span>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-sm">{formatCOP(v.total_valor)}</p>
                      <p className="text-xs text-gray-400">{v.total_pedidos} pedidos</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Productos más pedidos */}
          <div className="lg:col-span-2 bg-white rounded-lg shadow p-4">
            <h2 className="font-bold text-lg mb-4">Top 10 productos más pedidos</h2>
            {productosTop.length === 0 ? <p className="text-gray-400 text-sm">Sin pedidos en el período</p> : (
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="p-3 text-left text-sm">#</th>
                    <th className="p-3 text-left text-sm">Producto</th>
                    <th className="p-3 text-left text-sm">Categoría</th>
                    <th className="p-3 text-right text-sm">Unidades pedidas</th>
                  </tr>
                </thead>
                <tbody>
                  {productosTop.map((p, i) => (
                    <tr key={p.nombre} className="border-t hover:bg-gray-50">
                      <td className="p-3 text-sm text-gray-400">{i + 1}</td>
                      <td className="p-3 text-sm font-medium">{p.nombre}</td>
                      <td className="p-3 text-sm">{p.categoria}</td>
                      <td className="p-3 text-sm text-right font-bold">{p.total_pedido}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

        </div>
      )}
    </div>
  )
}